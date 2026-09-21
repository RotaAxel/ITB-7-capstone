<?php

namespace Database\Seeders;

use App\Models\Facility;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class HistoricalDataSeeder extends Seeder
{
    public function run(): void
    {
        // Skip clients that already have historical data (keeps this seeder safe to re-run,
        // e.g. after adding a fresh batch of clients).
        $clients  = User::where('role', 'client')->whereDoesntHave('reservations')->orderBy('id')->get();
        $reviewer = User::whereIn('role', ['administrator', 'staff'])->orderBy('id')->first();

        // Use first 3 available facilities (Basketball Court A, Swimming Pool, Gymnasium)
        $facilities = Facility::orderBy('id')->get()->take(3)->values();

        if ($clients->isEmpty() || $facilities->count() < 3) {
            $this->command->warn('Skipping HistoricalDataSeeder: missing clients or facilities.');
            return;
        }

        // Lookup maps: [facilityIndex] per reservation slot per client
        // Slot 0 = completed (historical), Slot 1 = cancelled/rejected, Slot 2 = pending/approved
        $facilityMap = [
            [0, 1, 2], [1, 2, 0], [2, 0, 1], [0, 2, 1], [1, 0, 2],
            [2, 1, 0], [0, 1, 2], [1, 2, 0], [2, 0, 1], [0, 2, 1],
            [1, 0, 2], [2, 1, 0], [0, 1, 2], [1, 2, 0], [2, 0, 1],
        ];

        $purposes = [
            'Basketball practice session',
            'Aquatic fitness training',
            'Volleyball match preparation',
            'Basketball skills development camp',
            'Swimming endurance training',
            'Multi-sport team activity',
            'Sports day rehearsal',
            'Athletic performance training',
            'Physical fitness conditioning class',
            'Youth sports development program',
            'Inter-school competition warm-up',
            'Circuit and agility training',
            'Group swim therapy session',
            'Basketball tournament preparation',
            'Sports camp activity day',
        ];

        // Time slots: [start, end]
        $timeSlots = [
            ['08:00', '10:00'], // 2h
            ['07:00', '09:00'], // 2h
            ['14:00', '16:00'], // 2h
            ['09:00', '11:00'], // 2h
            ['06:00', '08:00'], // 2h
            ['13:00', '16:00'], // 3h
            ['10:00', '12:00'], // 2h
            ['15:00', '17:00'], // 2h
            ['08:00', '11:00'], // 3h
            ['16:00', '18:00'], // 2h
            ['09:00', '12:00'], // 3h
            ['14:00', '17:00'], // 3h
            ['07:00', '09:00'], // 2h
            ['10:00', '13:00'], // 3h
            ['13:00', '15:00'], // 2h
        ];

        $participantCounts = [10, 8, 14, 12, 5, 20, 15, 10, 4, 18, 8, 25, 6, 10, 16];

        $paymentMethods = [
            'gcash', 'paymaya', 'card', 'gcash', 'gcash',
            'paymaya', 'card', 'gcash', 'qr_ph', 'paymaya',
            'card', 'gcash', 'qr_ph', 'paymaya', 'gcash',
        ];

        $rejectionNotes = [
            'Facility not available for the requested time slot.',
            'Request does not meet facility usage guidelines.',
            'Another reservation has already been approved for this slot.',
            'Insufficient documentation provided with the request.',
            'Requested capacity exceeds the facility limit.',
            'Facility is reserved for school events on that date.',
            'The time slot conflicts with scheduled maintenance.',
        ];

        $receiptCounter = 10001;

        // Tracks every "upcoming" (pending/approved) slot booked so far in this run,
        // keyed by facility_id, so Reservation 3 below can be shifted to a free date
        // instead of silently double-booking a facility. The date/timeslot formula
        // used to be purely a function of ($i % 180) and ($i % 15), which repeats
        // every 60 clients — with 1000+ seeded clients that produced dozens of
        // reservations for the same facility on the exact same date and time
        // (a real conflict the live booking flow would never allow; only possible
        // here because this seeder writes rows directly via DB::table(), bypassing
        // ReservationController::store()'s conflict check).
        $bookedSlots = [];

        // Also seed from whatever's already pending/approved/confirmed in the DB, so
        // re-running this seeder against a partially-seeded database can't collide
        // with rows a previous run already committed.
        DB::table('reservations')
            ->whereIn('status', ['pending', 'approved', 'confirmed'])
            ->get(['facility_id', 'reservation_date', 'start_time', 'end_time'])
            ->each(function ($r) use (&$bookedSlots) {
                $bookedSlots[$r->facility_id][] = [(string) $r->reservation_date, $r->start_time, $r->end_time];
            });

        $slotConflicts = function (int $facilityId, string $date, string $start, string $end) use (&$bookedSlots) {
            foreach ($bookedSlots[$facilityId] ?? [] as [$bDate, $bStart, $bEnd]) {
                if ($bDate === $date && $start < $bEnd && $end > $bStart) {
                    return true;
                }
            }
            return false;
        };

        foreach ($clients as $i => $client) {
            // Cycle through the 15 template variations regardless of how many
            // clients there are; date offsets below stay keyed on the raw $i
            // so every client still lands on a distinct date (no fake double-bookings).
            $idx  = $i % 15;
            $type = $idx % 3 === 0 ? 'book' : 'reserve';

            // ── RESERVATION 1: Completed (3–9 months ago, paid) ─────────────────
            $fac1      = $facilities[$facilityMap[$idx][0]];
            // Spread offsets across clients but wrap with modulo so, even with 1000+
            // clients, dates stay within a realistic ~2-year window instead of drifting
            // decades into the past/future.
            $daysAgo1  = 90 + (($i * 14) % 700);
            $date1     = Carbon::now()->subDays($daysAgo1)->toDateString();
            [$s1, $e1] = $timeSlots[$idx];
            // abs() because Carbon 3's diffInHours() returns a signed difference by
            // default (Carbon 2 always returned absolute) — without it, $e1 coming
            // "before" $s1 in the diff direction produces a negative duration/amount.
            $hours1    = abs(Carbon::createFromTimeString($e1)->diffInHours(Carbon::createFromTimeString($s1)));
            $amount1   = $hours1 * $fac1->price_per_hour;
            $created1  = Carbon::now()->subDays($daysAgo1 + 2);
            $updated1  = Carbon::now()->subDays($daysAgo1 - 3);

            $resId1 = DB::table('reservations')->insertGetId([
                'user_id'                => $client->id,
                'facility_id'            => $fac1->id,
                'purpose'                => $purposes[$idx],
                'number_of_participants' => $participantCounts[$idx],
                'reservation_date'       => $date1,
                'start_time'             => $s1,
                'end_time'               => $e1,
                'status'                 => 'completed',
                'type'                   => $type,
                'terms_acknowledged'     => 1,
                'terms_acknowledged_at'  => $created1->copy()->addHours(1),
                'reviewed_by'            => $reviewer?->id,
                'reviewed_at'            => Carbon::now()->subDays($daysAgo1 - 1),
                'admin_note'             => null,
                'selected_amenities'     => null,
                'created_at'             => $created1,
                'updated_at'             => $updated1,
            ]);

            $receiptNum1 = 'RCPT-' . str_pad($receiptCounter++, 5, '0', STR_PAD_LEFT);
            DB::table('payments')->insert([
                'reservation_id'             => $resId1,
                'user_id'                    => $client->id,
                'amount'                     => $amount1,
                'currency'                   => 'PHP',
                'status'                     => 'paid',
                'payment_method'             => $paymentMethods[$idx],
                'paymongo_payment_intent_id' => 'pi_test_' . Str::random(20),
                'paymongo_payment_method_id' => 'pm_test_' . Str::random(20),
                'receipt_number'             => $receiptNum1,
                'paid_at'                    => Carbon::now()->subDays($daysAgo1 - 2),
                'created_at'                 => $created1->copy()->addHours(2),
                'updated_at'                 => Carbon::now()->subDays($daysAgo1 - 2),
            ]);

            $this->insertNotification(
                $client->id, $resId1,
                'reservation_completed',
                'Reservation Completed',
                "Your reservation at {$fac1->name} on " . Carbon::parse($date1)->format('M d, Y') . " has been completed. Thank you for using our facility!",
                $updated1->copy(),
                true
            );

            // ── RESERVATION 2: Cancelled or Rejected (1–3 months ago) ───────────
            $fac2      = $facilities[$facilityMap[$idx][1]];
            $daysAgo2  = 30 + (($i * 5) % 300);
            $date2     = Carbon::now()->subDays($daysAgo2)->toDateString();
            [$s2, $e2] = $timeSlots[($idx + 5) % 15];
            $status2   = $idx < 8 ? 'cancelled' : 'rejected';
            $created2  = Carbon::now()->subDays($daysAgo2 + 2);
            $updated2  = Carbon::now()->subDays($daysAgo2);

            $resId2 = DB::table('reservations')->insertGetId([
                'user_id'                => $client->id,
                'facility_id'            => $fac2->id,
                'purpose'                => $purposes[($idx + 7) % 15],
                'number_of_participants' => $participantCounts[($idx + 3) % 15],
                'reservation_date'       => $date2,
                'start_time'             => $s2,
                'end_time'               => $e2,
                'status'                 => $status2,
                'type'                   => $type,
                'terms_acknowledged'     => $status2 === 'rejected' ? 1 : 0,
                'terms_acknowledged_at'  => $status2 === 'rejected' ? $created2->copy()->addHours(1) : null,
                'reviewed_by'            => $status2 === 'rejected' ? $reviewer?->id : null,
                'reviewed_at'            => $status2 === 'rejected' ? Carbon::now()->subDays($daysAgo2 - 1) : null,
                'admin_note'             => $status2 === 'rejected' ? $rejectionNotes[$idx % count($rejectionNotes)] : null,
                'selected_amenities'     => null,
                'created_at'             => $created2,
                'updated_at'             => $updated2,
            ]);

            $notifType2  = $status2 === 'cancelled' ? 'reservation_cancelled' : 'reservation_rejected';
            $notifTitle2 = $status2 === 'cancelled' ? 'Reservation Cancelled' : 'Reservation Rejected';
            $notifMsg2   = $status2 === 'cancelled'
                ? "Your reservation at {$fac2->name} on " . Carbon::parse($date2)->format('M d, Y') . " has been cancelled."
                : "Your reservation at {$fac2->name} on " . Carbon::parse($date2)->format('M d, Y') . " was not approved. Reason: " . $rejectionNotes[$idx % count($rejectionNotes)];

            $this->insertNotification($client->id, $resId2, $notifType2, $notifTitle2, $notifMsg2, $updated2->copy(), true);

            // ── RESERVATION 3: Pending or Approved (upcoming) ───────────────────
            $fac3        = $facilities[$facilityMap[$idx][2]];
            $futureDays  = 5 + (($i * 3) % 180);
            $date3       = Carbon::now()->addDays($futureDays)->toDateString();
            [$s3, $e3]   = $timeSlots[($idx + 10) % 15];

            // This is an "upcoming" reservation — i.e. it actually holds the facility
            // — so, unlike Reservations 1 and 2 above (historical/cancelled, which
            // don't block anything), it must not collide with another active booking.
            // Push the date forward a day at a time until it lands on a free slot.
            $shiftGuard = 0;
            while ($slotConflicts($fac3->id, $date3, $s3, $e3)) {
                $futureDays++;
                $date3 = Carbon::now()->addDays($futureDays)->toDateString();
                if (++$shiftGuard > 2000) {
                    throw new \RuntimeException("HistoricalDataSeeder: couldn't find a free slot for facility {$fac3->id}.");
                }
            }
            $bookedSlots[$fac3->id][] = [$date3, $s3, $e3];

            $hours3      = abs(Carbon::createFromTimeString($e3)->diffInHours(Carbon::createFromTimeString($s3)));
            $amount3     = $hours3 * $fac3->price_per_hour;
            $status3     = $idx < 10 ? 'pending' : 'approved';
            $created3    = Carbon::now()->subDays(3);
            $updated3    = Carbon::now()->subDays(1);

            $resId3 = DB::table('reservations')->insertGetId([
                'user_id'                => $client->id,
                'facility_id'            => $fac3->id,
                'purpose'                => $purposes[($idx + 3) % 15],
                'number_of_participants' => $participantCounts[($idx + 7) % 15],
                'reservation_date'       => $date3,
                'start_time'             => $s3,
                'end_time'               => $e3,
                'status'                 => $status3,
                'type'                   => $type,
                'terms_acknowledged'     => 1,
                'terms_acknowledged_at'  => $created3->copy()->addHours(1),
                'reviewed_by'            => $status3 === 'approved' ? $reviewer?->id : null,
                'reviewed_at'            => $status3 === 'approved' ? $updated3->copy() : null,
                'admin_note'             => null,
                'selected_amenities'     => null,
                'created_at'             => $created3,
                'updated_at'             => $updated3,
            ]);

            // Approved reservations get a pending payment awaiting collection
            if ($status3 === 'approved') {
                DB::table('payments')->insert([
                    'reservation_id' => $resId3,
                    'user_id'        => $client->id,
                    'amount'         => $amount3,
                    'currency'       => 'PHP',
                    'status'         => 'pending',
                    'payment_method' => null,
                    'created_at'     => $updated3,
                    'updated_at'     => $updated3,
                ]);
            }

            $notifType3  = $status3 === 'pending' ? 'reservation_pending' : 'reservation_approved';
            $notifTitle3 = $status3 === 'pending' ? 'Reservation Submitted' : 'Reservation Approved';
            $notifMsg3   = $status3 === 'pending'
                ? "Your reservation at {$fac3->name} on " . Carbon::parse($date3)->format('M d, Y') . " has been submitted and is awaiting review."
                : "Your reservation at {$fac3->name} on " . Carbon::parse($date3)->format('M d, Y') . " has been approved! Please proceed to complete your payment.";

            $this->insertNotification($client->id, $resId3, $notifType3, $notifTitle3, $notifMsg3, $updated3->copy(), false);
        }
    }

    private function insertNotification(
        int    $userId,
        int    $reservationId,
        string $type,
        string $title,
        string $message,
        Carbon $createdAt,
        bool   $read
    ): void {
        DB::table('notifications')->insert([
            'id'              => Str::uuid(),
            'type'            => $type,
            'notifiable_type' => 'App\Models\User',
            'notifiable_id'   => $userId,
            'data'            => json_encode([
                'title'          => $title,
                'message'        => $message,
                'reservation_id' => $reservationId,
            ]),
            'read_at'    => $read ? $createdAt->copy()->addHours(3)->toDateTimeString() : null,
            'created_at' => $createdAt->toDateTimeString(),
            'updated_at' => $createdAt->toDateTimeString(),
        ]);
    }
}
