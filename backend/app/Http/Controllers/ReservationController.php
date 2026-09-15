<?php

namespace App\Http\Controllers;

use App\Models\Facility;
use App\Models\Payment;
use App\Models\Reservation;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ReservationController extends Controller
{
    // ─── Client / shared listing ──────────────────────────────────────────────

    public function index(Request $request)
    {
        $user = $request->user();

        $query = Reservation::with(['facility', 'payment'])
            ->when($user->isClient(), fn($q) => $q->where('user_id', $user->id))
            ->when($request->filled('status'),      fn($q) => $q->where('status', $request->status))
            ->when($request->filled('facility_id'), fn($q) => $q->where('facility_id', $request->facility_id))
            ->when($request->filled('date'),        fn($q) => $q->where('reservation_date', $request->date))
            ->orderByDesc('created_at');

        return response()->json($query->get());
    }

    // ─── Admin / staff listing ────────────────────────────────────────────────

    public function adminIndex(Request $request)
    {
        $query = Reservation::with(['user', 'facility', 'payment'])
            ->when($request->filled('status'),      fn($q) => $q->where('status', $request->status))
            ->when($request->filled('facility_id'), fn($q) => $q->where('facility_id', $request->facility_id))
            ->when($request->filled('date'),        fn($q) => $q->where('reservation_date', $request->date))
            ->when($request->filled('date_from'),   fn($q) => $q->where('reservation_date', '>=', $request->date_from))
            ->when($request->filled('date_to'),     fn($q) => $q->where('reservation_date', '<=', $request->date_to))
            ->orderByDesc('created_at');

        return response()->json($query->paginate(20));
    }

    // ─── Store ────────────────────────────────────────────────────────────────

    public function store(Request $request)
    {
        $validated = $request->validate([
            'facility_id'            => ['required', 'exists:facilities,id'],
            'purpose'                => ['required', 'string'],
            'number_of_participants' => ['required', 'integer', 'min:1'],
            'reservation_date'       => ['required', 'date', 'after_or_equal:today'],
            'start_time'             => ['required', 'date_format:H:i'],
            'end_time'               => ['required', 'date_format:H:i', 'after:start_time'],
            'selected_amenities'     => ['nullable', 'array'],
            'selected_amenities.*'   => ['integer', 'exists:amenities,id'],
            'terms_acknowledged'     => ['boolean'],
            'type'                   => ['required', 'in:reserve,book'],
            'authorization_letter'   => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:5120'],
        ]);

        $facility = Facility::findOrFail($validated['facility_id']);

        if ($facility->status !== 'available') {
            return response()->json([
                'message' => "This facility is currently {$facility->status} and cannot be reserved.",
            ], 422);
        }

        if ($facility->requires_authorization_letter && !$request->hasFile('authorization_letter')) {
            return response()->json([
                'message' => "{$facility->name} requires an authorization letter to be attached before you can submit a reservation.",
            ], 422);
        }

        // Check participant capacity
        if ($validated['number_of_participants'] > $facility->capacity) {
            return response()->json([
                'message' => "Number of participants exceeds facility capacity of {$facility->capacity}.",
            ], 422);
        }

        // Conflict check
        $conflict = Reservation::where('facility_id', $validated['facility_id'])
            ->where('reservation_date', $validated['reservation_date'])
            ->whereIn('status', ['pending', 'approved', 'confirmed'])
            ->where(function ($q) use ($validated) {
                $q->where(function ($inner) use ($validated) {
                    $inner->where('start_time', '<', $validated['end_time'])
                          ->where('end_time', '>', $validated['start_time']);
                });
            })
            ->exists();

        if ($conflict) {
            return response()->json([
                'message' => 'This time slot is already booked. Please choose a different time.',
            ], 422);
        }

        // Calculate amount — use timestamps to avoid Carbon 3 signed-diff behaviour
        $startTs = strtotime($validated['reservation_date'] . ' ' . $validated['start_time']);
        $endTs   = strtotime($validated['reservation_date'] . ' ' . $validated['end_time']);
        $hours   = max(0, ($endTs - $startTs) / 3600);
        $amount  = round($facility->price_per_hour * $hours, 2);

        // Private ("local") disk, not the public one facility images use — this can
        // be a personally-identifying document, served only via an authenticated
        // download route rather than a guessable public URL.
        $letterPath = $request->hasFile('authorization_letter')
            ? $request->file('authorization_letter')->store('authorization-letters', 'local')
            : null;

        $reservation = Reservation::create([
            'user_id'                   => $request->user()->id,
            'facility_id'               => $validated['facility_id'],
            'purpose'                   => $validated['purpose'],
            'number_of_participants'    => $validated['number_of_participants'],
            'reservation_date'          => $validated['reservation_date'],
            'start_time'                => $validated['start_time'],
            'end_time'                  => $validated['end_time'],
            'selected_amenities'        => $validated['selected_amenities'] ?? null,
            'status'                    => 'pending',
            'type'                      => $validated['type'],
            'terms_acknowledged'        => $validated['terms_acknowledged'] ?? false,
            'terms_acknowledged_at'     => ($validated['terms_acknowledged'] ?? false) ? now() : null,
            'authorization_letter_path' => $letterPath,
        ]);

        Payment::create([
            'reservation_id' => $reservation->id,
            'user_id'        => $request->user()->id,
            'amount'         => $amount,
            'currency'       => 'PHP',
            'status'         => 'pending',
        ]);

        $typeLabel = $validated['type'] === 'book' ? 'a booking (instant confirm on payment)' : 'a reservation request';

        NotificationService::notifyAdmins(
            'new_reservation',
            'New Reservation Request',
            "{$request->user()->full_name} submitted {$typeLabel} for {$facility->name} on {$validated['reservation_date']} from {$validated['start_time']} to {$validated['end_time']}.",
            $reservation->id
        );

        return response()->json($reservation->load(['facility', 'payment']), 201);
    }

    // ─── Destroy (abandoned/unpaid) ───────────────────────────────────────────

    public function destroy(Request $request, $id)
    {
        $user        = $request->user();
        $reservation = Reservation::with('payment')->findOrFail($id);

        if ($reservation->user_id !== $user->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        if ($reservation->status !== 'pending' || $reservation->payment?->status === 'paid') {
            return response()->json(['message' => 'Only unpaid pending reservations can be removed.'], 422);
        }

        $reservation->payment?->delete();
        $reservation->delete();

        return response()->json(['message' => 'Reservation removed.']);
    }

    // ─── Show ─────────────────────────────────────────────────────────────────

    public function show(Request $request, $id)
    {
        $user        = $request->user();
        $reservation = Reservation::with(['user', 'facility', 'payment', 'reviewer'])->findOrFail($id);

        if ($user->isClient() && $reservation->user_id !== $user->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        return response()->json($reservation);
    }

    // ─── Authorization Letter (download) ──────────────────────────────────────

    public function downloadAuthorizationLetter(Request $request, $id)
    {
        $user        = $request->user();
        $reservation = Reservation::findOrFail($id);

        if ($user->isClient() && $reservation->user_id !== $user->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        if (!$reservation->authorization_letter_path) {
            return response()->json(['message' => 'No authorization letter was submitted for this reservation.'], 404);
        }

        if (!Storage::disk('local')->exists($reservation->authorization_letter_path)) {
            return response()->json(['message' => 'The authorization letter file is missing.'], 404);
        }

        $extension = pathinfo($reservation->authorization_letter_path, PATHINFO_EXTENSION);

        return Storage::disk('local')->download(
            $reservation->authorization_letter_path,
            "authorization-letter-reservation-{$reservation->id}.{$extension}"
        );
    }

    // ─── Cancel ───────────────────────────────────────────────────────────────

    public function cancel(Request $request, $id)
    {
        $user        = $request->user();
        $reservation = Reservation::with('payment')->findOrFail($id);

        if ($user->isClient() && $reservation->user_id !== $user->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        // 'approved' covers a "reserve" request that's cleared admin review but
        // hasn't been paid yet — the client can still back out at that point.
        if (!in_array($reservation->status, ['pending', 'approved'], true)) {
            return response()->json(['message' => 'Only pending or approved reservations can be cancelled.'], 422);
        }

        if ($reservation->payment && $reservation->payment->status === 'paid') {
            return response()->json(['message' => 'Cannot cancel a reservation with a completed payment. No refunds.'], 422);
        }

        $reservation->update(['status' => 'cancelled']);

        if ($reservation->payment && $reservation->payment->status === 'pending') {
            $reservation->payment->update(['status' => 'cancelled']);
        }

        NotificationService::notifyAdmins(
            'reservation_cancelled',
            'Reservation Cancelled',
            "Reservation #{$reservation->id} for {$reservation->facility->name} on {$reservation->reservation_date->format('M d, Y')} was cancelled by {$user->full_name}.",
            $reservation->id
        );

        return response()->json(['message' => 'Reservation cancelled successfully.', 'reservation' => $reservation->fresh()]);
    }

    // ─── Acknowledge Terms ────────────────────────────────────────────────────

    public function acknowledgeTerms(Request $request, $id)
    {
        $reservation = Reservation::findOrFail($id);

        if ($reservation->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $reservation->update([
            'terms_acknowledged'    => true,
            'terms_acknowledged_at' => now(),
        ]);

        return response()->json(['message' => 'Terms acknowledged.', 'reservation' => $reservation->fresh()]);
    }

    // ─── Admin: Approve ───────────────────────────────────────────────────────

    public function approve(Request $request, $id)
    {
        $reservation = Reservation::with(['user', 'facility', 'payment'])->findOrFail($id);

        if ($reservation->status !== 'pending') {
            return response()->json(['message' => 'Only pending reservations can be approved.'], 422);
        }

        // Safety net — this shouldn't happen since store() already requires the
        // letter up front, but guards against older data or a bypassed client.
        if ($reservation->facility->requires_authorization_letter && !$reservation->authorization_letter_path) {
            return response()->json([
                'message' => "{$reservation->facility->name} requires an authorization letter, but none was submitted with this reservation.",
            ], 422);
        }

        // "Reserve" requests are approved *before* payment — this is what unlocks
        // the client's terms/payment step (see PaymentController). "Book"
        // reservations pay first and auto-confirm on payment (handleSuccess), so
        // reaching this branch for a 'book' type only happens as a manual
        // fallback for a stuck or missed payment webhook.
        if ($reservation->type === 'reserve') {
            $reservation->update([
                'status'      => 'approved',
                'reviewed_by' => $request->user()->id,
                'reviewed_at' => now(),
            ]);

            NotificationService::notifyUser(
                $reservation->user,
                'reservation_approved',
                'Reservation Approved — Proceed to Payment',
                "Your reservation request for {$reservation->facility->name} on {$reservation->reservation_date->format('M d, Y')} has been approved. Please complete payment to confirm your slot.",
                $reservation->id
            );

            return response()->json([
                'message'     => 'Reservation approved. The client can now proceed to payment.',
                'reservation' => $reservation->fresh()->load(['user', 'facility', 'payment']),
            ]);
        }

        if (!$reservation->payment || $reservation->payment->status !== 'paid') {
            return response()->json(['message' => 'Payment must be completed before this reservation can be approved.'], 422);
        }

        $reservation->update([
            'status'      => 'confirmed',
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
        ]);

        NotificationService::notifyUser(
            $reservation->user,
            'reservation_approved',
            'Reservation Confirmed',
            "Your reservation for {$reservation->facility->name} on {$reservation->reservation_date->format('M d, Y')} has been approved and is now confirmed. We'll see you then!",
            $reservation->id
        );

        return response()->json(['message' => 'Reservation approved.', 'reservation' => $reservation->fresh()->load(['user', 'facility', 'payment'])]);
    }

    // ─── Admin: Reject ────────────────────────────────────────────────────────

    public function reject(Request $request, $id)
    {
        $request->validate([
            'admin_note' => ['required', 'string'],
        ]);

        $reservation = Reservation::with(['user', 'facility', 'payment'])->findOrFail($id);

        // 'approved' so an admin can still revoke a "reserve" approval before
        // the client has paid (e.g. the facility became unavailable meanwhile).
        if (!in_array($reservation->status, ['pending', 'approved'], true)) {
            return response()->json(['message' => 'Only pending or approved reservations can be rejected.'], 422);
        }

        if ($reservation->payment && $reservation->payment->status === 'paid') {
            return response()->json(['message' => 'Cannot reject a reservation with a completed payment. No refunds.'], 422);
        }

        $reservation->update([
            'status'      => 'rejected',
            'admin_note'  => $request->admin_note,
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
        ]);

        if ($reservation->payment && $reservation->payment->status === 'pending') {
            $reservation->payment->update(['status' => 'rejected']);
        }

        NotificationService::notifyUser(
            $reservation->user,
            'reservation_rejected',
            'Reservation Rejected',
            "Your reservation for {$reservation->facility->name} on {$reservation->reservation_date->format('M d, Y')} was rejected. Reason: {$request->admin_note}",
            $reservation->id
        );

        return response()->json(['message' => 'Reservation rejected.', 'reservation' => $reservation->fresh()]);
    }

    // ─── Admin/Staff: Complete ────────────────────────────────────────────────

    public function complete(Request $request, $id)
    {
        $reservation = Reservation::with(['user', 'facility'])->findOrFail($id);

        if ($reservation->status !== 'confirmed') {
            return response()->json(['message' => 'Only confirmed reservations can be marked as completed.'], 422);
        }

        $endDateTime = \Carbon\Carbon::parse(
            $reservation->reservation_date->format('Y-m-d') . ' ' . $reservation->end_time
        );

        if ($endDateTime->isFuture()) {
            return response()->json(['message' => 'Reservation cannot be completed before its end time.'], 422);
        }

        $reservation->update(['status' => 'completed']);

        NotificationService::notifyUser(
            $reservation->user,
            'reservation_completed',
            'Reservation Completed',
            "Your reservation for {$reservation->facility->name} on {$reservation->reservation_date->format('M d, Y')} has been marked as completed. Thank you!",
            $reservation->id
        );

        return response()->json(['message' => 'Reservation marked as completed.', 'reservation' => $reservation->fresh()]);
    }
}
