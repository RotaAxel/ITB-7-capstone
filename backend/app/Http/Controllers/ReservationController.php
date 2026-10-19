<?php

namespace App\Http\Controllers;

use App\Models\Amenity;
use App\Models\Facility;
use App\Models\Payment;
use App\Models\Reservation;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ReservationController extends Controller
{
    // At or above this many participants, a reservation is treated as a "large
    // event" and must include crowd management confirmation and event
    // considerations — below it, those fields aren't even shown on the form.
    // Waste management confirmation is NOT gated by this threshold — every
    // reservation, regardless of size, must confirm it (see store() and
    // acknowledgeTerms() below).
    private const LARGE_EVENT_THRESHOLD = 50;

    // Purely descriptive event-type label a client can optionally attach to a
    // reservation (e.g. "Birthday Event") — no pricing or business-logic
    // impact, just lets clients/admins categorize at a glance. Mirrored in the
    // frontend's EVENT_PACKAGES list (NewReservationModal.jsx / NewReservation.jsx).
    public const EVENT_PACKAGES = [
        'Birthday Event',
        'Wedding Event',
        'Corporate Event',
        'Sports Event',
        'School Event',
        'Other',
    ];

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
            // Priority reservations (e.g. the mayor's office / city hall events)
            // always surface at the top of the queue, regardless of filters or how
            // recently they were submitted.
            ->orderByDesc('is_priority')
            ->orderByDesc('created_at');

        return response()->json($query->paginate(20));
    }

    // ─── Store ────────────────────────────────────────────────────────────────

    public function store(Request $request)
    {
        $validated = $request->validate([
            'facility_id'            => ['required', 'exists:facilities,id'],
            'purpose'                => ['required', 'string'],
            'event_package'          => ['nullable', 'string', 'in:' . implode(',', self::EVENT_PACKAGES)],
            'event_considerations'   => ['nullable', 'string'],
            // Large events no longer describe a waste/crowd management plan in
            // free text — they just check two separate boxes confirming they'll
            // provide each, per the Terms & Conditions clauses covering them (see
            // termsFor() in NewReservationModal.jsx / NewReservation.jsx / TermsPage.jsx).
            'crowd_management_confirmed' => ['sometimes'],
            'waste_management_confirmed' => ['sometimes'],
            'number_of_participants' => ['required', 'integer', 'min:1'],
            // Either a single date+time (the ordinary path — every existing caller
            // keeps working unchanged) or several dates bundled into one request
            // (e.g. "every Saturday in March"), each carrying its *own* time slot —
            // only facility, purpose, amenities, letters, and terms are shared
            // across every date in the bundle.
            'reservation_date'              => ['required_without:reservation_dates', 'nullable', 'date', 'after_or_equal:today'],
            'start_time'                    => ['required_without:reservation_dates', 'nullable', 'date_format:H:i'],
            'end_time'                      => ['required_without:reservation_dates', 'nullable', 'date_format:H:i', 'after:start_time'],
            'reservation_dates'              => ['required_without:reservation_date', 'nullable', 'array', 'min:1', 'max:30'],
            'reservation_dates.*.date'       => ['required', 'date', 'after_or_equal:today'],
            'reservation_dates.*.start_time' => ['required', 'date_format:H:i'],
            'reservation_dates.*.end_time'   => ['required', 'date_format:H:i'],
            'selected_amenities'     => ['nullable', 'array'],
            'selected_amenities.*'   => ['integer', 'exists:amenities,id'],
            // How many units of each *quantifiable* selected amenity (chairs,
            // tables) the client wants — keyed by amenity id. Ignored for any
            // amenity that isn't quantifiable (those stay a flat on/off
            // selection); cross-checked against each amenity's own stock and the
            // system-wide cap below, not trusted at face value.
            'amenity_quantities'     => ['nullable', 'array'],
            'amenity_quantities.*'   => ['integer', 'min:1'],
            // Not "boolean" — this request posts as multipart/form-data whenever an
            // authorization letter is attached (a real file upload can't travel any
            // other way), and a checkbox/flag in multipart arrives as the literal
            // string "true"/"false". Laravel's "boolean" rule only accepts
            // true/false/1/0/'1'/'0' — NOT the strings "true"/"false" — so every
            // reservation submitted together with a required authorization letter
            // was rejected with a 422 here, no matter what. $request->boolean()
            // below already normalizes any of these forms correctly.
            'terms_acknowledged'     => ['sometimes'],
            'type'                   => ['required', 'in:reserve,book'],
            'authorization_letter'   => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:5120'],
            // Distinct from authorization_letter — the formal letter requesting use
            // of the facility itself, vs. a letter authorizing the requester to book
            // on an organization's behalf. A facility can require either, both, or
            // neither; see Facility::requires_request_letter.
            'request_letter'         => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:5120'],
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

        if ($facility->requires_request_letter && !$request->hasFile('request_letter')) {
            return response()->json([
                'message' => "{$facility->name} requires a request letter to be attached before you can submit a reservation.",
            ], 422);
        }

        // A facility that requires an authorization or request letter always needs
        // staff to actually look at that letter before anything is confirmed —
        // that's incompatible with "Book", which auto-confirms the moment payment
        // clears with no human review. The frontend already only offers "Reserve"
        // for these facilities; this is the server-side backstop against a direct
        // API call trying to force "book" through anyway.
        if (($facility->requires_authorization_letter || $facility->requires_request_letter) && $validated['type'] === 'book') {
            $letterKind = $facility->requires_authorization_letter && $facility->requires_request_letter
                ? 'an authorization letter and a request letter'
                : ($facility->requires_authorization_letter ? 'an authorization letter' : 'a request letter');
            return response()->json([
                'message' => "{$facility->name} requires {$letterKind}, so it only accepts reservation requests, not instant bookings.",
            ], 422);
        }

        // Check participant capacity
        if ($validated['number_of_participants'] > $facility->capacity) {
            return response()->json([
                'message' => "Number of participants exceeds facility capacity of {$facility->capacity}.",
            ], 422);
        }

        // Large events need pre-/post-event considerations on file, plus crowd
        // management confirmation — the frontend already only shows these once
        // participants cross the threshold, so this is the server-side backstop
        // against a direct API call skipping them.
        if ($validated['number_of_participants'] >= self::LARGE_EVENT_THRESHOLD) {
            $missing = array_filter([
                'event_considerations' => 'pre-event and post-event considerations',
            ], fn ($label, $field) => empty($validated[$field] ?? null), ARRAY_FILTER_USE_BOTH);

            // The crowd management confirmation lives in the Terms & Conditions
            // step. The modal flow collects it there before this same request
            // (terms_acknowledged is already true), so check it now; the
            // full-page flow always submits terms_acknowledged=false and defers
            // it to its separate TermsPage visit afterward (see
            // acknowledgeTerms() below), so it's not required yet here.
            if ($request->boolean('terms_acknowledged') && !$request->boolean('crowd_management_confirmed')) {
                $missing['crowd_management_confirmed'] = 'confirmation that you will provide crowd management (see Terms & Conditions)';
            }

            if ($missing) {
                return response()->json([
                    'message' => 'Events with ' . self::LARGE_EVENT_THRESHOLD . ' or more participants must include '
                        . implode(', ', $missing) . '.',
                ], 422);
            }
        }

        // Waste management confirmation is required for every reservation,
        // regardless of event size — not gated by LARGE_EVENT_THRESHOLD like
        // crowd management above. Same deferral as crowd management: only
        // enforced now if terms are already acknowledged in this request (the
        // modal flow); the full-page flow defers it to acknowledgeTerms().
        if ($request->boolean('terms_acknowledged') && !$request->boolean('waste_management_confirmed')) {
            return response()->json([
                'message' => 'Please confirm you will provide waste management (see Terms & Conditions).',
            ], 422);
        }

        // Slots to create — a plain `reservation_date`/`start_time`/`end_time`
        // becomes a one-element list, so the single-date path below (and every
        // response it produces) is byte-for-byte identical to before this
        // feature existed. Each slot in a bundle carries its own time, so a
        // client can e.g. book 9am-11am on one date and 2pm-5pm on another.
        $slots = $validated['reservation_dates'] ?? [[
            'date'       => $validated['reservation_date'],
            'start_time' => $validated['start_time'],
            'end_time'   => $validated['end_time'],
        ]];

        // A wildcard array rule (e.g. "reservation_dates.*.end_time" => "after:
        // reservation_dates.*.start_time") can't reliably cross-reference a
        // sibling field at the same index, so each slot's own end-after-start
        // is checked by hand instead.
        foreach ($slots as $slot) {
            if ($slot['end_time'] <= $slot['start_time']) {
                return response()->json([
                    'message' => "{$slot['date']}: end time must be after start time.",
                ], 422);
            }
        }

        $duplicateDates = collect($slots)->pluck('date')->duplicates();
        if ($duplicateDates->isNotEmpty()) {
            return response()->json([
                'message' => 'Each date in the bundle must be unique: ' . $duplicateDates->implode(', ') . ' was added more than once.',
            ], 422);
        }

        $slots = collect($slots)->sortBy('date')->values()->all();
        $dates = collect($slots)->pluck('date')->all();
        $isGroup = count($slots) > 1;

        // Conflict check — every date (with its own time slot) in the bundle, up
        // front, before creating anything. Each existing reservation's blocked
        // window is padded by the facility's cleaning/setup buffer
        // (Facility::buffer_minutes) on both sides before checking for overlap,
        // so a new request can't be squeezed in immediately before/after another
        // one with no time to prepare the facility.
        $bufferMinutes = $facility->buffer_minutes;
        $bufferTime = sprintf('%02d:%02d:00', intdiv($bufferMinutes, 60), $bufferMinutes % 60);

        $conflictDates = [];
        foreach ($slots as $slot) {
            $conflict = Reservation::where('facility_id', $validated['facility_id'])
                ->where('reservation_date', $slot['date'])
                ->whereIn('status', ['pending', 'approved', 'confirmed'])
                ->whereRaw('? < ADDTIME(end_time, ?) AND ? > SUBTIME(start_time, ?)', [
                    $slot['start_time'], $bufferTime,
                    $slot['end_time'], $bufferTime,
                ])
                ->exists();
            if ($conflict) {
                $conflictDates[] = $slot['date'];
            }
        }

        if ($conflictDates) {
            $bufferNote = $bufferMinutes > 0
                ? " (this facility needs a {$bufferMinutes}-minute gap before/after each reservation to prepare and clean)"
                : '';
            $message = $isGroup
                ? 'One or more of these dates/times are already booked' . $bufferNote . ': ' . implode(', ', $conflictDates) . '. Please adjust and try again.'
                : 'This time slot is already booked' . $bufferNote . '. Please choose a different time.';
            return response()->json(['message' => $message], 422);
        }

        // Large-event prep/cleanup day block — distinct from the time-of-day
        // buffer above, this blocks whole calendar days around a large event
        // (see Facility::large_event_buffer_days), for the extended setup/
        // teardown a large event needs. It cuts both ways: a day next to an
        // EXISTING large event is off-limits to any new reservation (large or
        // small), and if THIS request is itself a large event, none of its own
        // prep/cleanup days may already carry any other reservation.
        $isNewLargeEvent = $validated['number_of_participants'] >= self::LARGE_EVENT_THRESHOLD;
        $prepDays = $facility->large_event_buffer_days;

        if ($prepDays > 0) {
            $dayBlockDates = [];
            foreach ($slots as $slot) {
                $windowStart = date('Y-m-d', strtotime("{$slot['date']} -{$prepDays} days"));
                $windowEnd   = date('Y-m-d', strtotime("{$slot['date']} +{$prepDays} days"));

                $nearby = Reservation::where('facility_id', $validated['facility_id'])
                    ->whereIn('status', ['pending', 'approved', 'confirmed'])
                    ->whereBetween('reservation_date', [$windowStart, $windowEnd])
                    ->where('reservation_date', '!=', $slot['date'])
                    ->get(['reservation_date', 'number_of_participants']);

                foreach ($nearby as $existing) {
                    $existingIsLargeEvent = $existing->number_of_participants >= self::LARGE_EVENT_THRESHOLD;
                    if ($isNewLargeEvent || $existingIsLargeEvent) {
                        $dayBlockDates[] = $slot['date'];
                        break;
                    }
                }
            }

            if ($dayBlockDates) {
                return response()->json([
                    'message' => 'These dates fall within a large event\'s prep/cleanup window and cannot be '
                        . 'booked: ' . implode(', ', array_unique($dayBlockDates)) . '. This facility blocks '
                        . $prepDays . ' day(s) before and after a large event (50+ participants).',
                ], 422);
            }
        }

        // Each selected amenity ("material") can carry its own additional fee —
        // flat per selection for a normal amenity, or *per unit* for a
        // quantifiable one (chairs, tables — see Amenity::is_quantifiable), where
        // the client picks how many they need. Charged once per date in the
        // bundle (each date gets its own full set of amenities/quantities).
        // Re-derived from the DB rather than trusting any client-sent amount or
        // quantity, so neither can be tampered with.
        $amenitiesFee = 0;
        $amenityQuantitiesToStore = [];
        if (!empty($validated['selected_amenities'])) {
            $amenities = Amenity::whereIn('id', $validated['selected_amenities'])->get();
            $requestedQuantities = $validated['amenity_quantities'] ?? [];

            foreach ($amenities as $amenity) {
                if (!$amenity->is_quantifiable) {
                    $amenitiesFee += $amenity->fee;
                    continue;
                }

                $maxAllowed = min($amenity->quantity, Amenity::MAX_QUANTITY_PER_RESERVATION);
                $requested  = (int) ($requestedQuantities[$amenity->id] ?? 1);

                if ($requested < 1 || $requested > $maxAllowed) {
                    return response()->json([
                        'message' => "{$amenity->name}: quantity must be between 1 and {$maxAllowed}.",
                    ], 422);
                }

                $amenitiesFee += $amenity->fee * $requested;
                $amenityQuantitiesToStore[$amenity->id] = $requested;
            }
        }

        // Facility::rateFor() returns the discounted resident_price_per_hour only
        // for a verified Cabuyeño resident (and only when the facility has one set)
        // — re-derived from the authenticated user's own server-side verification
        // status, never trusted from the client.
        $rate = $facility->rateFor($request->user());

        // Whether this bundle is free (₱0 all-in, e.g. the Open Field) depends only
        // on the shared rate and amenities fee, never on any one date's duration —
        // every slot's own start/end time is already validated to be non-zero
        // length, so rate=0 and amenitiesFee=0 is the only way any slot's amount
        // can come out to ₱0, and that's true for every slot in the bundle alike.
        $isFree = $rate <= 0 && $amenitiesFee <= 0;

        // Private ("local") disk, not the public one facility images use — this can
        // be a personally-identifying document, served only via an authenticated
        // download route rather than a guessable public URL. Stored once and the
        // same path reused on every reservation row in the bundle — the client
        // only uploads one letter covering the whole multi-date request.
        $letterPath = $request->hasFile('authorization_letter')
            ? $request->file('authorization_letter')->store('authorization-letters', 'local')
            : null;

        $requestLetterPath = $request->hasFile('request_letter')
            ? $request->file('request_letter')->store('request-letters', 'local')
            : null;

        $termsAcknowledged = $request->boolean('terms_acknowledged');
        $crowdManagementConfirmed = $request->boolean('crowd_management_confirmed');
        $wasteManagementConfirmed = $request->boolean('waste_management_confirmed');
        $groupId = $isGroup ? (string) Str::uuid() : null;

        $reservations = DB::transaction(function () use (
            $slots, $groupId, $validated, $request, $rate, $amenitiesFee, $isFree,
            $termsAcknowledged, $crowdManagementConfirmed, $wasteManagementConfirmed,
            $letterPath, $requestLetterPath, $amenityQuantitiesToStore
        ) {
            return collect($slots)->map(function ($slot) use (
                $groupId, $validated, $request, $rate, $amenitiesFee, $isFree,
                $termsAcknowledged, $crowdManagementConfirmed, $wasteManagementConfirmed,
                $letterPath, $requestLetterPath, $amenityQuantitiesToStore
            ) {
                // Each date's own duration (via timestamps, to avoid Carbon 3
                // signed-diff behaviour) — differing time slots in a bundle mean
                // differing hours, and so a differing amount, per date.
                $startTs = strtotime($slot['date'] . ' ' . $slot['start_time']);
                $endTs   = strtotime($slot['date'] . ' ' . $slot['end_time']);
                $hours   = max(0, ($endTs - $startTs) / 3600);
                $amount  = round($rate * $hours + $amenitiesFee, 2);

                $reservation = Reservation::create([
                    'user_id'                   => $request->user()->id,
                    'facility_id'                => $validated['facility_id'],
                    'reservation_group_id'       => $groupId,
                    'purpose'                    => $validated['purpose'],
                    'event_package'              => $validated['event_package'] ?? null,
                    'event_considerations'       => $validated['event_considerations'] ?? null,
                    'crowd_management_confirmed' => $crowdManagementConfirmed,
                    'waste_management_confirmed' => $wasteManagementConfirmed,
                    'number_of_participants'     => $validated['number_of_participants'],
                    'reservation_date'           => $slot['date'],
                    'start_time'                 => $slot['start_time'],
                    'end_time'                   => $slot['end_time'],
                    'selected_amenities'         => $validated['selected_amenities'] ?? null,
                    'amenity_quantities'         => !empty($amenityQuantitiesToStore) ? $amenityQuantitiesToStore : null,
                    // Only skips straight to 'confirmed' if terms are *already*
                    // acknowledged in this same request (the modal booking flow
                    // collects agreement before submitting) — the full-page flow
                    // always submits this false and still needs a separate Terms
                    // step first, which is where acknowledgeTerms() finishes the
                    // job for a free reservation once that happens.
                    'status'                     => ($isFree && $termsAcknowledged && $validated['type'] === 'book') ? 'confirmed' : 'pending',
                    'type'                       => $validated['type'],
                    'terms_acknowledged'         => $termsAcknowledged,
                    'terms_acknowledged_at'      => $termsAcknowledged ? now() : null,
                    'authorization_letter_path'  => $letterPath,
                    'request_letter_path'        => $requestLetterPath,
                ]);

                Payment::create([
                    'reservation_id' => $reservation->id,
                    'user_id'        => $request->user()->id,
                    'amount'         => $amount,
                    'currency'       => 'PHP',
                    'status'         => $isFree ? 'paid' : 'pending',
                    ...($isFree ? [
                        'paid_at'        => now(),
                        'payment_method' => 'free',
                        'receipt_number' => 'CABS-' . now()->format('Y') . '-' . strtoupper(Str::random(6)),
                    ] : []),
                ]);

                return $reservation;
            });
        });

        $typeLabel = $isFree
            ? ($validated['type'] === 'book' ? 'a free booking (no payment required)' : 'a free reservation request')
            : ($validated['type'] === 'book' ? 'a booking (instant confirm on payment)' : 'a reservation request');

        if ($isGroup) {
            // Each date can carry its own time slot now, so the notification lists
            // them individually rather than assuming one shared time for the bundle.
            $slotList = collect($slots)->map(fn ($s) => "{$s['date']} ({$s['start_time']}-{$s['end_time']})")->implode(', ');
            NotificationService::notifyAdmins(
                'new_reservation',
                'New Multi-Date Reservation Request',
                "{$request->user()->full_name} submitted {$typeLabel} for {$facility->name} on " . count($dates)
                    . " dates: {$slotList}.",
                $reservations->first()->id
            );

            return response()->json([
                'group_id'     => $groupId,
                // collect()->map() returns a plain Support Collection, not an
                // Eloquent one — no collection-wide load(), so load() per item
                // via the each() higher-order proxy instead.
                'reservations' => $reservations->each->load(['facility', 'payment']),
            ], 201);
        }

        $reservation = $reservations->first();

        NotificationService::notifyAdmins(
            'new_reservation',
            'New Reservation Request',
            "{$request->user()->full_name} submitted {$typeLabel} for {$facility->name} on {$slots[0]['date']} from {$slots[0]['start_time']} to {$slots[0]['end_time']}.",
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
        // facility.amenities (not just facility) so the frontend can resolve
        // selected_amenities' names/fees without a second request — used by the
        // receipt views to itemize the amenities/materials fee.
        $reservation = Reservation::with(['user', 'facility.amenities', 'payment', 'reviewer'])->findOrFail($id);

        if ($user->isClient() && $reservation->user_id !== $user->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        return response()->json($reservation);
    }

    // ─── Group: Show ──────────────────────────────────────────────────────────

    public function showGroup(Request $request, $groupId)
    {
        $user = $request->user();

        $reservations = Reservation::with(['user', 'facility.amenities', 'payment', 'reviewer'])
            ->where('reservation_group_id', $groupId)
            ->orderBy('reservation_date')
            ->get();

        if ($reservations->isEmpty()) {
            return response()->json(['message' => 'Reservation group not found.'], 404);
        }

        if ($user->isClient() && $reservations->first()->user_id !== $user->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        return response()->json([
            'group_id'     => $groupId,
            'reservations' => $reservations,
            'total_amount' => $reservations->sum(fn ($r) => (float) ($r->payment->amount ?? 0)),
        ]);
    }

    // ─── Group: Approve / Reject / Cancel ──────────────────────────────────────
    // Thin wrappers that reuse the exact same per-reservation logic and
    // notifications as the single-reservation endpoints above — just looped
    // across every member of the group — rather than duplicating that logic, so
    // a single-date reservation's behavior can never drift from a group
    // member's.

    public function approveGroup(Request $request, $groupId)
    {
        return $this->runGroupAction($groupId, fn ($id) => $this->approve($request, $id));
    }

    public function rejectGroup(Request $request, $groupId)
    {
        $request->validate(['admin_note' => ['required', 'string']]);
        return $this->runGroupAction($groupId, fn ($id) => $this->reject($request, $id));
    }

    public function cancelGroup(Request $request, $groupId)
    {
        return $this->runGroupAction($groupId, fn ($id) => $this->cancel($request, $id));
    }

    // A bundle is N independent Reservation rows, each with its own
    // terms_acknowledged flag — acknowledging terms on just the first one (which
    // is all the single-reservation endpoint can see) would leave the rest
    // unacknowledged, and PaymentController::createGroupLink() requires every
    // member to have agreed before it'll create the group's payment link.
    public function acknowledgeTermsGroup(Request $request, $groupId)
    {
        return $this->runGroupAction($groupId, fn ($id) => $this->acknowledgeTerms($request, $id));
    }

    private function runGroupAction(string $groupId, \Closure $action)
    {
        $ids = Reservation::where('reservation_group_id', $groupId)->pluck('id');

        if ($ids->isEmpty()) {
            return response()->json(['message' => 'Reservation group not found.'], 404);
        }

        $results = [];
        foreach ($ids as $id) {
            $response = $action($id);
            $results[$id] = [
                'status'  => $response->getStatusCode(),
                'message' => json_decode($response->getContent(), true)['message'] ?? null,
            ];
        }

        $failed    = collect($results)->filter(fn ($r) => $r['status'] >= 400);
        $succeeded = count($results) - $failed->count();

        return response()->json([
            'group_id' => $groupId,
            'results'  => $results,
            'message'  => $failed->isEmpty()
                ? 'Applied to all ' . count($results) . ' reservation(s) in the group.'
                : "{$succeeded} of " . count($results) . " succeeded; {$failed->count()} failed (see results for details).",
        ]);
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

    // ─── Request Letter (download) ─────────────────────────────────────────────

    public function downloadRequestLetter(Request $request, $id)
    {
        $user        = $request->user();
        $reservation = Reservation::findOrFail($id);

        if ($user->isClient() && $reservation->user_id !== $user->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        if (!$reservation->request_letter_path) {
            return response()->json(['message' => 'No request letter was submitted for this reservation.'], 404);
        }

        if (!Storage::disk('local')->exists($reservation->request_letter_path)) {
            return response()->json(['message' => 'The request letter file is missing.'], 404);
        }

        $extension = pathinfo($reservation->request_letter_path, PATHINFO_EXTENSION);

        return Storage::disk('local')->download(
            $reservation->request_letter_path,
            "request-letter-reservation-{$reservation->id}.{$extension}"
        );
    }

    // ─── Cancel ───────────────────────────────────────────────────────────────

    public function cancel(Request $request, $id)
    {
        $user        = $request->user();
        $reservation = Reservation::with('payment')->findOrFail($id);

        // Cancelling is the client's own call to make — staff/admin "handle"
        // reservations via approve/reject/complete, but no longer cancel on a
        // client's behalf. Only the owning client may cancel their own request.
        if (!$user->isClient() || $reservation->user_id !== $user->id) {
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
        $reservation = Reservation::with(['user', 'facility', 'payment'])->findOrFail($id);

        if ($reservation->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        // Crowd management confirmation is large-events only; waste management
        // confirmation is required for every reservation regardless of size
        // (two independent checkboxes — see termsFor() in
        // NewReservationModal.jsx / TermsPage.jsx). The modal flow already
        // collected both at creation time (see store()); this is the full-page
        // flow's chance to do so, since its Terms step is this separate screen.
        $isLargeEvent = $reservation->number_of_participants >= self::LARGE_EVENT_THRESHOLD;
        $missing = [];
        if ($isLargeEvent && !$reservation->crowd_management_confirmed && !$request->boolean('crowd_management_confirmed')) {
            $missing[] = 'crowd management';
        }
        if (!$reservation->waste_management_confirmed && !$request->boolean('waste_management_confirmed')) {
            $missing[] = 'waste management';
        }
        if ($missing) {
            return response()->json([
                'message' => 'Please confirm you will provide ' . implode(' and ', $missing) . ' before proceeding.',
            ], 422);
        }

        $reservation->update([
            'terms_acknowledged'    => true,
            'terms_acknowledged_at' => now(),
            'waste_management_confirmed' => true,
            ...($isLargeEvent ? ['crowd_management_confirmed' => true] : []),
        ]);

        $this->confirmIfFreeAndReady($reservation);

        return response()->json(['message' => 'Terms acknowledged.', 'reservation' => $reservation->fresh()]);
    }

    // A free reservation (facility price ₱0, see Facility::rateFor()) has its
    // Payment auto-marked 'paid' the moment it's created (see store()) — there's
    // nothing left to actually pay, so once both gates that would normally lead
    // to payment are cleared (terms acknowledged, and — for "reserve" — admin
    // approval already given), it confirms immediately instead of sitting
    // around waiting for a payment step that will never come. Called from both
    // acknowledgeTerms() and approve() since either can be the gate that clears
    // last, depending on whether the client agrees to terms before or after
    // their request is approved.
    private function confirmIfFreeAndReady(Reservation $reservation): void
    {
        $readyToConfirm = $reservation->terms_acknowledged
            && $reservation->payment && $reservation->payment->status === 'paid'
            && (
                ($reservation->type === 'book' && $reservation->status === 'pending')
                || ($reservation->type === 'reserve' && $reservation->status === 'approved')
            );

        if (!$readyToConfirm) {
            return;
        }

        $reservation->update(['status' => 'confirmed']);

        NotificationService::notifyUser(
            $reservation->user,
            'reservation_confirmed',
            $reservation->type === 'book' ? 'Booking Confirmed' : 'Reservation Confirmed',
            "Your {$reservation->facility->name} reservation on {$reservation->reservation_date->format('M d, Y')} is confirmed — this facility is free of charge, so no payment is required.",
            $reservation->id
        );
    }

    // ─── Admin: Approve ───────────────────────────────────────────────────────

    public function approve(Request $request, $id)
    {
        $reservation = Reservation::with(['user', 'facility', 'payment'])->findOrFail($id);

        if ($reservation->status !== 'pending') {
            return response()->json(['message' => 'Only pending reservations can be approved.'], 422);
        }

        // Safety net — this shouldn't happen since store() already requires the
        // letter(s) up front, but guards against older data or a bypassed client.
        if ($reservation->facility->requires_authorization_letter && !$reservation->authorization_letter_path) {
            return response()->json([
                'message' => "{$reservation->facility->name} requires an authorization letter, but none was submitted with this reservation.",
            ], 422);
        }
        if ($reservation->facility->requires_request_letter && !$reservation->request_letter_path) {
            return response()->json([
                'message' => "{$reservation->facility->name} requires a request letter, but none was submitted with this reservation.",
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

            // Free facility + terms already acknowledged (the client agreed before
            // this approval ever happened) — skip straight past "awaiting payment"
            // since there's nothing to pay. confirmIfFreeAndReady() sends its own
            // "confirmed" notification when it applies, so no "proceed to payment"
            // one follows it in that case.
            $reservation->refresh();
            $this->confirmIfFreeAndReady($reservation);

            if ($reservation->status === 'confirmed') {
                return response()->json([
                    'message'     => 'Reservation approved and confirmed — this facility is free, no payment required.',
                    'reservation' => $reservation->fresh()->load(['user', 'facility', 'payment']),
                ]);
            }

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

    // ─── Admin/Staff: Priority flag + internal note ────────────────────────────
    // Distinct from admin_note (the client-facing rejection reason) — this is
    // staff/admin's own private reference, never shown to the client, and can be
    // set on a reservation at any status, any time.

    public function updateNotes(Request $request, $id)
    {
        $reservation = Reservation::findOrFail($id);

        $validated = $request->validate([
            'is_priority'   => ['sometimes', 'boolean'],
            'internal_note' => ['nullable', 'string'],
        ]);

        $reservation->update($validated);

        return response()->json($reservation->fresh());
    }
}
