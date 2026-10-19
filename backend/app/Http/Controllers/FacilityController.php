<?php

namespace App\Http\Controllers;

use App\Models\Amenity;
use App\Models\Facility;
use App\Models\MaintenanceLog;
use App\Models\Reservation;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class FacilityController extends Controller
{
    public function index(Request $request)
    {
        $query = Facility::with(['amenities' => fn($q) => $q->where('is_available', true)]);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $facilities = $query->orderBy('name')->get()->map(function ($facility) {
            return array_merge($facility->toArray(), [
                'amenities_count' => $facility->amenities->count(),
                'image_url' => $facility->image_path
                    ? asset('storage/' . $facility->image_path)
                    : null,
            ]);
        });

        return response()->json($facilities);
    }

    public function show($id)
    {
        $facility = Facility::with('amenities')->findOrFail($id);

        $bookedSlots = Reservation::where('facility_id', $id)
            ->whereIn('status', ['pending', 'approved', 'confirmed', 'completed'])
            ->whereBetween('reservation_date', [
                now()->subMonths(3)->toDateString(),
                now()->addMonths(6)->toDateString(),
            ])
            ->select('reservation_date', 'start_time', 'end_time', 'status')
            ->orderBy('reservation_date')
            ->orderBy('start_time')
            ->get()
            ->map(fn ($s) => [
                'reservation_date' => $s->reservation_date->format('Y-m-d'),
                'start_time'       => substr($s->start_time, 0, 5),
                'end_time'         => substr($s->end_time,   0, 5),
                'status'           => $s->status,
            ]);

        return response()->json(array_merge($facility->toArray(), [
            'booked_slots' => $bookedSlots,
            'image_url' => $facility->image_path
                ? asset('storage/' . $facility->image_path)
                : null,
        ]));
    }

    public function getAvailability($id, Request $request)
    {
        $request->validate([
            'date' => ['required', 'date'],
            // Optional — the client doesn't know its own participant count until
            // a later step in the booking form than the date (see below), so this
            // is only present once that's been entered.
            'participants' => ['nullable', 'integer', 'min:1'],
        ]);

        $facility = Facility::findOrFail($id);

        $slots = Reservation::where('facility_id', $id)
            ->where('reservation_date', $request->date)
            ->whereIn('status', ['pending', 'approved', 'confirmed'])
            ->select('start_time', 'end_time', 'status')
            ->orderBy('start_time')
            ->get()
            // Padded by the facility's cleaning/setup buffer on both sides so what
            // the client sees as "already booked" matches what store()'s conflict
            // check will actually reject — otherwise a slot that looks free here
            // could still get rejected at submission time.
            ->map(function ($slot) use ($facility) {
                $start = \Carbon\Carbon::createFromFormat('H:i:s', $slot->start_time)
                    ->subMinutes($facility->buffer_minutes);
                $end = \Carbon\Carbon::createFromFormat('H:i:s', $slot->end_time)
                    ->addMinutes($facility->buffer_minutes);

                return [
                    'start_time' => $start->format('H:i:s'),
                    'end_time'   => $end->format('H:i:s'),
                    'status'     => $slot->status,
                ];
            })
            ->values()
            ->all();

        // This whole day may also be blocked outright if it falls within a
        // nearby large event's prep/cleanup window (see
        // Facility::large_event_buffer_days and the matching check in
        // ReservationController::store()) — distinct from the per-slot buffer
        // padding above, which only pads an actual booked time range. 50
        // mirrors ReservationController::LARGE_EVENT_THRESHOLD. This cuts both
        // ways, same as store(): an existing large event blocks a new
        // reservation of any size, and — once the caller tells us via
        // ?participants= that THIS would itself be a large event — any nearby
        // reservation at all (large or small) blocks it right back.
        if ($facility->large_event_buffer_days > 0) {
            $prepDays    = $facility->large_event_buffer_days;
            $windowStart = date('Y-m-d', strtotime("{$request->date} -{$prepDays} days"));
            $windowEnd   = date('Y-m-d', strtotime("{$request->date} +{$prepDays} days"));
            $isNewLargeEvent = ($request->integer('participants')) >= 50;

            $nearbyQuery = Reservation::where('facility_id', $id)
                ->whereIn('status', ['pending', 'approved', 'confirmed'])
                ->whereBetween('reservation_date', [$windowStart, $windowEnd])
                ->where('reservation_date', '!=', $request->date);

            $nearbyBlocking = $isNewLargeEvent
                ? $nearbyQuery->exists()
                : $nearbyQuery->where('number_of_participants', '>=', 50)->exists();

            if ($nearbyBlocking) {
                $slots[] = [
                    'start_time' => '00:00:00',
                    'end_time'   => '23:59:59',
                    'status'     => 'large_event_block',
                ];
            }
        }

        return response()->json($slots);
    }

    // ─── Admin CRUD ───────────────────────────────────────────────────────────

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'          => ['required', 'string', 'max:255'],
            'description'   => ['required', 'string'],
            'location'      => ['required', 'string', 'max:255'],
            'capacity'      => ['required', 'integer', 'min:1'],
            // Minutes blocked before/after every reservation for cleaning/setup —
            // see the migration that added this column.
            'buffer_minutes' => ['nullable', 'integer', 'min:0', 'max:480'],
            // Whole calendar days blocked before/after a large event (50+
            // participants) — see the migration that added this column.
            'large_event_buffer_days' => ['nullable', 'integer', 'min:0', 'max:14'],
            'price_per_hour'=> ['required', 'numeric', 'min:0'],
            // Discounted rate for verified Cabuyeño residents — null/omitted means
            // no resident discount, everyone pays price_per_hour.
            'resident_price_per_hour' => ['nullable', 'numeric', 'min:0'],
            'status'        => ['in:available,under_maintenance,unavailable'],
            // Not "boolean" — this form posts as multipart/form-data, where a checkbox
            // arrives as the literal string "true"/"false", and Laravel's "boolean"
            // rule only accepts true/false/1/0/'1'/'0' (NOT the strings "true"/"false"),
            // so every submission with this field present — i.e. every submission,
            // since it's always sent — was rejected with a 422. $request->boolean()
            // below already normalizes any of these forms correctly, so this field
            // just needs to be present, not strictly typed.
            'requires_authorization_letter' => ['sometimes'],
            // Same multipart-boolean caveat as above — see that comment.
            'requires_request_letter' => ['sometimes'],
            // All optional, facility-specific terms content — see the migration that
            // added these columns. Free text, not structured, since restrictions/what-
            // to-bring reasonably vary in shape per facility (a list for one, a
            // paragraph for another).
            'what_to_bring'         => ['nullable', 'string'],
            'restrictions'          => ['nullable', 'string'],
            'additional_terms'      => ['nullable', 'string'],
            'excessive_mess_fee'    => ['nullable', 'numeric', 'min:0'],
            'damage_clearance_fee'  => ['nullable', 'numeric', 'min:0'],
            // Laravel's 'image' rule doesn't accept SVG in this version even though
            // it's a perfectly valid image (fileinfo correctly detects it as
            // image/svg+xml) — use an explicit mimes list instead so SVG uploads
            // aren't rejected with a misleading "must be an image" error.
            'image'         => ['nullable', 'file', 'mimes:jpg,jpeg,png,gif,webp,svg', 'max:2048'],
        ]);

        $imagePath = null;
        if ($request->hasFile('image')) {
            $imagePath = $request->file('image')->store('facilities', 'public');
        }

        $facility = Facility::create([
            'name'           => $validated['name'],
            'description'    => $validated['description'],
            'location'       => $validated['location'],
            'capacity'       => $validated['capacity'],
            'buffer_minutes' => $validated['buffer_minutes'] ?? 30,
            'large_event_buffer_days' => $validated['large_event_buffer_days'] ?? 1,
            'price_per_hour' => $validated['price_per_hour'],
            'resident_price_per_hour' => $validated['resident_price_per_hour'] ?? null,
            'status'         => $validated['status'] ?? 'available',
            'image_path'     => $imagePath,
            'requires_authorization_letter' => $request->boolean('requires_authorization_letter'),
            'requires_request_letter' => $request->boolean('requires_request_letter'),
            'what_to_bring'        => $validated['what_to_bring'] ?? null,
            'restrictions'         => $validated['restrictions'] ?? null,
            'additional_terms'     => $validated['additional_terms'] ?? null,
            'excessive_mess_fee'   => $validated['excessive_mess_fee'] ?? null,
            'damage_clearance_fee' => $validated['damage_clearance_fee'] ?? null,
        ]);

        return response()->json($facility->load('amenities'), 201);
    }

    public function update(Request $request, $id)
    {
        $facility = Facility::findOrFail($id);

        $validated = $request->validate([
            'name'          => ['sometimes', 'string', 'max:255'],
            'description'   => ['sometimes', 'string'],
            'location'      => ['sometimes', 'string', 'max:255'],
            'capacity'      => ['sometimes', 'integer', 'min:1'],
            'buffer_minutes' => ['nullable', 'integer', 'min:0', 'max:480'],
            'large_event_buffer_days' => ['nullable', 'integer', 'min:0', 'max:14'],
            'price_per_hour'=> ['sometimes', 'numeric', 'min:0'],
            'resident_price_per_hour' => ['nullable', 'numeric', 'min:0'],
            'status'        => ['sometimes', 'in:available,under_maintenance,unavailable'],
            // See the comment on this same rule in store() above — not "boolean".
            'requires_authorization_letter' => ['sometimes'],
            'requires_request_letter' => ['sometimes'],
            // See the comment on these same fields in store() above.
            'what_to_bring'         => ['nullable', 'string'],
            'restrictions'          => ['nullable', 'string'],
            'additional_terms'      => ['nullable', 'string'],
            'excessive_mess_fee'    => ['nullable', 'numeric', 'min:0'],
            'damage_clearance_fee'  => ['nullable', 'numeric', 'min:0'],
            // Laravel's 'image' rule doesn't accept SVG in this version even though
            // it's a perfectly valid image (fileinfo correctly detects it as
            // image/svg+xml) — use an explicit mimes list instead so SVG uploads
            // aren't rejected with a misleading "must be an image" error.
            'image'         => ['nullable', 'file', 'mimes:jpg,jpeg,png,gif,webp,svg', 'max:2048'],
        ]);

        if ($request->hasFile('image')) {
            if ($facility->image_path) {
                Storage::disk('public')->delete($facility->image_path);
            }
            $validated['image_path'] = $request->file('image')->store('facilities', 'public');
        }

        // This form posts as multipart/form-data, so a checkbox arrives as the
        // string "true"/"false" — $request->boolean() normalizes that correctly
        // (a raw (bool) cast would treat the string "false" as truthy).
        if ($request->has('requires_authorization_letter')) {
            $validated['requires_authorization_letter'] = $request->boolean('requires_authorization_letter');
        }
        if ($request->has('requires_request_letter')) {
            $validated['requires_request_letter'] = $request->boolean('requires_request_letter');
        }

        unset($validated['image']);
        $facility->update($validated);

        return response()->json($facility->load('amenities'));
    }

    public function destroy($id)
    {
        $facility = Facility::findOrFail($id);

        if ($facility->image_path) {
            Storage::disk('public')->delete($facility->image_path);
        }

        $facility->delete();

        return response()->json(['message' => 'Facility deleted successfully.']);
    }

    public function updateMaintenance(Request $request, $id)
    {
        $facility = Facility::findOrFail($id);

        $validated = $request->validate([
            'status'             => ['required', 'in:available,under_maintenance,unavailable'],
            'maintenance_note'   => ['nullable', 'string'],
            'maintenance_start'  => ['nullable', 'date'],
            'maintenance_end'    => ['nullable', 'date', 'after_or_equal:maintenance_start'],
        ]);

        $facility->update($validated);

        MaintenanceLog::create([
            'facility_id' => $facility->id,
            'admin_id'    => $request->user()->id,
            'note'        => $validated['maintenance_note'] ?? 'Status updated to ' . $validated['status'],
            'start_date'  => $validated['maintenance_start'] ?? now()->toDateString(),
            'end_date'    => $validated['maintenance_end'] ?? now()->toDateString(),
        ]);

        // Notify clients with active reservations for this facility
        if ($validated['status'] !== 'available') {
            $affectedReservations = Reservation::where('facility_id', $facility->id)
                ->whereIn('status', ['pending', 'approved'])
                ->where('reservation_date', '>=', now()->toDateString())
                ->with('user')
                ->get();

            foreach ($affectedReservations as $reservation) {
                NotificationService::notifyUser(
                    $reservation->user,
                    'facility_maintenance',
                    'Facility Under Maintenance',
                    "The {$facility->name} has been set to {$validated['status']}. Your reservation on {$reservation->reservation_date->format('M d, Y')} may be affected. Please contact us for assistance.",
                    $reservation->id
                );
            }
        }

        return response()->json($facility->fresh());
    }

    // ─── Amenity CRUD ─────────────────────────────────────────────────────────

    public function storeAmenity(Request $request)
    {
        $validated = $request->validate([
            'facility_id'  => ['required', 'exists:facilities,id'],
            'name'         => ['required', 'string', 'max:255'],
            'description'  => ['nullable', 'string'],
            // Also the stock ceiling for a quantifiable amenity — capped at 1000
            // regardless (see Amenity::MAX_QUANTITY_PER_RESERVATION).
            'quantity'     => ['required', 'integer', 'min:1', 'max:1000'],
            // Flat per-selection charge for a normal amenity; *per unit* when
            // is_quantifiable is true — see the migration that added that column.
            'fee'          => ['nullable', 'numeric', 'min:0'],
            'is_quantifiable' => ['boolean'],
            'is_available' => ['boolean'],
        ]);

        $amenity = Amenity::create($validated);

        return response()->json($amenity, 201);
    }

    public function updateAmenity(Request $request, $id)
    {
        $amenity = Amenity::findOrFail($id);

        $validated = $request->validate([
            'name'         => ['sometimes', 'string', 'max:255'],
            'description'  => ['nullable', 'string'],
            'quantity'     => ['sometimes', 'integer', 'min:1', 'max:1000'],
            'fee'          => ['nullable', 'numeric', 'min:0'],
            'is_quantifiable' => ['boolean'],
            'is_available' => ['boolean'],
        ]);

        $amenity->update($validated);

        return response()->json($amenity);
    }

    public function destroyAmenity($id)
    {
        Amenity::findOrFail($id)->delete();

        return response()->json(['message' => 'Amenity deleted.']);
    }
}
