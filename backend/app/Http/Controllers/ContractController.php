<?php

namespace App\Http\Controllers;

use App\Models\Amenity;
use App\Models\Reservation;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

// Printable "Contract of Agreement" (Kontrata) — the same Terms & Conditions
// the client already reads and digitally acknowledges (see TermsPage.jsx /
// NewReservationModal.jsx's termsFor()/facilityTermsFor(), mirrored here in
// PHP) plus a signature block for both parties, for anyone who wants a
// physically-signed paper copy on file. Purely a formal/print artifact — it
// has no bearing on terms_acknowledged or the reservation's status, which are
// still driven entirely by the digital acknowledgement flow.
class ContractController extends Controller
{
    public function download(Request $request, $id)
    {
        $user        = $request->user();
        $reservation = Reservation::with(['user', 'facility', 'payment'])->findOrFail($id);

        if ($user->isClient() && $reservation->user_id !== $user->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        return $this->render(collect([$reservation]), null);
    }

    public function downloadGroup(Request $request, $groupId)
    {
        $user = $request->user();

        $reservations = Reservation::with(['user', 'facility', 'payment'])
            ->where('reservation_group_id', $groupId)
            ->orderBy('reservation_date')
            ->get();

        if ($reservations->isEmpty()) {
            return response()->json(['message' => 'Reservation group not found.'], 404);
        }

        if ($user->isClient() && $reservations->first()->user_id !== $user->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        return $this->render($reservations, $groupId);
    }

    private function render($reservations, ?string $groupId)
    {
        $first    = $reservations->first();
        $facility = $first->facility;

        // Shared across every date in a bundle (facility, purpose, amenities,
        // participants, type) — only the date/time/amount differ per slot,
        // listed individually in the "Reservation Details" table.
        $amenities = [];
        if ($first->selected_amenities) {
            $requestedQuantities = $first->amenity_quantities ?? [];
            $amenities = Amenity::whereIn('id', $first->selected_amenities)
                ->get(['id', 'name', 'is_quantifiable'])
                ->map(fn ($a) => [
                    'name'               => $a->name,
                    'is_quantifiable'    => $a->is_quantifiable,
                    'requested_quantity' => $a->is_quantifiable ? (int) ($requestedQuantities[$a->id] ?? 1) : null,
                ])
                ->toArray();
        }

        // Embedded as a base64 data URI rather than a file:// or http:// <img src>
        // — dompdf resolves those against the server's remote-fetch settings,
        // which is fragile; a data URI always works regardless of that config.
        $logoPath   = resource_path('images/logoCabs.png');
        $logoBase64 = is_file($logoPath)
            ? 'data:image/png;base64,' . base64_encode(file_get_contents($logoPath))
            : null;

        // A unique control number stamped on every printout so a signed paper copy
        // can be traced back to the run that produced it.
        $controlNumber = 'CABS-CTR-' . now()->format('Ymd-His') . '-' . strtoupper(Str::random(4));

        $pdf = Pdf::loadView('pdf.contract', [
            'reservations'  => $reservations,
            'first'         => $first,
            'facility'      => $facility,
            'amenities'     => $amenities,
            'totalAmount'   => $reservations->sum(fn ($r) => (float) ($r->payment->amount ?? 0)),
            'groupId'       => $groupId,
            'controlNumber' => $controlNumber,
            'generatedAt'   => now(),
            'logoBase64'    => $logoBase64,
        ])->setPaper('a4', 'portrait');

        $filename = $groupId
            ? "CABS-Contract-Group-{$groupId}.pdf"
            : "CABS-Contract-Reservation-{$first->id}.pdf";

        return $pdf->download($filename);
    }
}
