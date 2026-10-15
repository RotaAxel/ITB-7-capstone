<?php

namespace App\Http\Controllers;

use App\Models\Reservation;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;

class ReceiptController extends Controller
{
    public function download(Request $request, $reservationId)
    {
        $user        = $request->user();
        $reservation = Reservation::with(['user', 'facility', 'payment'])->findOrFail($reservationId);

        if ($user->isClient() && $reservation->user_id !== $user->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $payment = $reservation->payment;

        if (!$payment || $payment->status !== 'paid') {
            return response()->json(['message' => 'Receipt is only available for paid reservations.'], 422);
        }

        // Build selected amenities list, and split the paid amount into its two
        // components (facility rental vs. amenities/materials fees) purely for
        // display — the actual charged amount always comes from $payment->amount.
        // A quantifiable amenity (chairs, tables) shows how many were actually
        // requested and its per-unit fee × that count; a normal one just shows its
        // flat fee — never the facility's own stock quantity, which isn't what was
        // billed.
        $amenities = [];
        $amenitiesFee = 0;
        if ($reservation->selected_amenities) {
            $requestedQuantities = $reservation->amenity_quantities ?? [];
            $amenities = \App\Models\Amenity::whereIn('id', $reservation->selected_amenities)
                ->get(['id', 'name', 'fee', 'is_quantifiable'])
                ->map(function ($a) use ($requestedQuantities, &$amenitiesFee) {
                    $qty = $a->is_quantifiable ? (int) ($requestedQuantities[$a->id] ?? 1) : null;
                    $lineTotal = (float) $a->fee * ($qty ?? 1);
                    $amenitiesFee += $lineTotal;

                    return [
                        'id'                 => $a->id,
                        'name'               => $a->name,
                        'fee'                => (float) $a->fee,
                        'is_quantifiable'    => $a->is_quantifiable,
                        'requested_quantity' => $qty,
                        'line_total'         => $lineTotal,
                    ];
                })
                ->toArray();
        }
        $facilitySubtotal = round($payment->amount - $amenitiesFee, 2);

        // Purely a display label — the Cabuyeño discount (if any) is already baked
        // into $payment->amount from the moment the reservation was created (see
        // Facility::rateFor() in ReservationController::store()).
        $residentRateApplied = $reservation->user->isVerifiedResident()
            && $reservation->facility->resident_price_per_hour !== null;

        // Narrow "till roll" page instead of A4 — 80mm is the standard thermal
        // receipt width. Height is estimated from content (base layout + one line
        // per amenity + wrapped lines of the terms/restrictions text) rather than a
        // fixed A4 height, so there's no leftover blank page below a short receipt
        // and no overflow onto a second page for a long one.
        $widthPt  = 227; // 80mm

        // Same condensed terms text the template renders (see receipt.blade.php) —
        // wordwrap at roughly the receipt's usable character width (9px font in
        // ~199pt of content width) to estimate how many lines it'll actually take.
        $facility = $reservation->facility;
        $termsText = 'No refunds once payment has been made. CABS / Cabuyao City Hall may cancel any '
            . 'reservation for maintenance, emergencies, or public need, with a full refund in that '
            . 'case. Users are liable for any damage caused to the facility or equipment.';
        if ($facility->restrictions) {
            $termsText .= ' Restrictions: ' . $facility->restrictions;
        }
        if ($facility->excessive_mess_fee > 0 || $facility->damage_clearance_fee > 0) {
            $termsText .= ' Fees apply if applicable, assessed after inspection, not charged upfront.';
        }
        $termsLines = substr_count(wordwrap($termsText, 44, "\n", true), "\n") + 1;

        // +16 flat covers the extra "Amenities / Materials" subtotal row the
        // template adds when $amenitiesFee > 0.
        $heightPt = 620 + (count($amenities) * 16) + ($termsLines * 12) + ($amenitiesFee > 0 ? 16 : 0);

        $pdf = Pdf::loadView('pdf.receipt', [
            'reservation'      => $reservation,
            'payment'          => $payment,
            'amenities'        => $amenities,
            'amenitiesFee'     => $amenitiesFee,
            'facilitySubtotal' => $facilitySubtotal,
            'residentRateApplied' => $residentRateApplied,
        ])->setPaper([0, 0, $widthPt, $heightPt]);

        $filename = "CABS-Receipt-{$payment->receipt_number}.pdf";

        return $pdf->download($filename);
    }
}
