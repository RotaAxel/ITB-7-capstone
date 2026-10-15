<?php

namespace Database\Seeders;

use App\Models\Amenity;
use App\Models\Facility;
use Illuminate\Database\Seeder;

class AmenitySeeder extends Seeder
{
    public function run(): void
    {
        $amenityMap = [
            // 'fee' is a flat additional charge added to the reservation total if the
            // client selects that amenity — omitted (defaults to 0) for items that are
            // just part of using the facility rather than extra rented materials.
            'Basketball Court A' => [
                ['name' => 'Basketball',    'description' => 'Standard size basketball', 'quantity' => 5],
                ['name' => 'Ball Pump',     'description' => 'Manual ball pump',          'quantity' => 2],
                ['name' => 'Scoreboard',    'description' => 'Electronic scoreboard',     'quantity' => 1,   'fee' => 200.00],
                // Quantifiable — the client picks how many chairs they need rather
                // than it being tied to participant count; 'fee' is per chair and
                // 'quantity' is the rentable stock (capped at 1000, see Amenity).
                ['name' => 'Chairs',        'description' => 'Plastic chairs for players','quantity' => 40,  'fee' => 10.00, 'is_quantifiable' => true],
            ],
            'Swimming Pool' => [
                ['name' => 'Lane Rope',     'description' => 'Standard lane divider rope', 'quantity' => 8],
                ['name' => 'Kickboard',     'description' => 'Swimming training kickboard','quantity' => 10],
                ['name' => 'Life Buoy',     'description' => 'Emergency life buoy',        'quantity' => 4],
                ['name' => 'Shower Room',   'description' => 'Access to shower facilities','quantity' => 4, 'is_available' => true],
            ],
            'Gymnasium' => [
                ['name' => 'Volleyball',    'description' => 'Standard volleyball',       'quantity' => 4],
                ['name' => 'Volleyball Net','description' => 'Official volleyball net',   'quantity' => 2],
                ['name' => 'Badminton Set', 'description' => 'Net, rackets, shuttlecocks','quantity' => 3],
                ['name' => 'Folding Tables','description' => 'Folding tables for events', 'quantity' => 20,  'fee' => 300.00],
                // Quantifiable, up to the 1000-chair cap — a large assembly (city
                // hall/mayor's office events) can genuinely need that many.
                ['name' => 'Folding Chairs','description' => 'Folding chairs for events', 'quantity' => 1000, 'fee' => 15.00, 'is_quantifiable' => true],
                ['name' => 'Sound System',  'description' => 'PA system with microphone', 'quantity' => 1,   'fee' => 500.00],
            ],
            'Tennis Court' => [
                ['name' => 'Tennis Racket', 'description' => 'Standard tennis racket',   'quantity' => 4, 'is_available' => false],
                ['name' => 'Tennis Ball',   'description' => 'Pack of 3 tennis balls',   'quantity' => 10,'is_available' => false],
                ['name' => 'Net',           'description' => 'Official tennis net',       'quantity' => 1, 'is_available' => false],
            ],
        ];

        foreach ($amenityMap as $facilityName => $amenities) {
            $facility = Facility::where('name', $facilityName)->first();
            if (!$facility) continue;

            foreach ($amenities as $amenity) {
                Amenity::create(array_merge(['facility_id' => $facility->id], $amenity));
            }
        }
    }
}
