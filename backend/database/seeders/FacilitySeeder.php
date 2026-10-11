<?php

namespace Database\Seeders;

use App\Models\Facility;
use Illuminate\Database\Seeder;

class FacilitySeeder extends Seeder
{
    public function run(): void
    {
        $facilities = [
            [
                'name'          => 'Basketball Court A',
                'description'   => 'Full-size outdoor basketball court with concrete flooring, hoops, and lighting for evening games.',
                'location'      => 'Main Campus, Building A - Ground Floor',
                'capacity'      => 40,
                'price_per_hour'=> 500.00,
                'status'        => 'available',
                'what_to_bring'        => 'Your own basketball (one is also provided), appropriate athletic shoes, and a valid ID for check-in.',
                'restrictions'         => 'No food or drinks on the court surface. Rubber-soled athletic shoes only — no street shoes or cleats. Pets are not allowed, except service animals.',
                'excessive_mess_fee'   => 500.00,
                'damage_clearance_fee' => 1000.00,
            ],
            [
                'name'          => 'Swimming Pool',
                'description'   => 'Olympic-size swimming pool with lane dividers, starting blocks, and shower facilities.',
                'location'      => 'Main Campus, Sports Complex',
                'capacity'      => 50,
                'price_per_hour'=> 1000.00,
                'status'        => 'available',
                'what_to_bring'        => 'Swimwear, a towel, and a valid ID. Goggles and swim caps are recommended but not provided.',
                'restrictions'         => 'No diving in shallow areas. Children under 12 must be accompanied by an adult. No food, drinks, glass containers, or pets near the pool deck. Shower before entering the pool.',
                'excessive_mess_fee'   => 800.00,
                'damage_clearance_fee' => 1500.00,
            ],
            [
                'name'          => 'Gymnasium',
                'description'   => 'Multi-purpose indoor gymnasium suitable for basketball, volleyball, badminton, and other sports.',
                'location'      => 'Main Campus, Gymnasium Building',
                'capacity'      => 100,
                'price_per_hour'=> 800.00,
                'status'        => 'available',
                'what_to_bring'        => 'Your own equipment if not listed under Amenities, a valid ID, and your own first-aid kit for larger events.',
                'restrictions'         => 'No food or drinks inside the court area — a separate area is available for events. Decorations must not be taped, nailed, or stapled to walls or flooring. Pets are not allowed, except service animals.',
                'additional_terms'     => 'For events with 50 or more participants, a designated event coordinator must be present at all times and is responsible for crowd management.',
                'excessive_mess_fee'   => 1500.00,
                'damage_clearance_fee' => 3000.00,
            ],
            [
                'name'          => 'Tennis Court',
                'description'   => 'Professional tennis court with clay surface, net, and seating area for spectators.',
                'location'      => 'Main Campus, East Wing',
                'capacity'      => 20,
                'price_per_hour'=> 600.00,
                'status'        => 'under_maintenance',
                'maintenance_note' => 'Resurfacing and net replacement in progress.',
                'maintenance_start' => now()->format('Y-m-d'),
                'maintenance_end'   => now()->addDays(7)->format('Y-m-d'),
                'what_to_bring'        => 'Your own racket and balls if not using the provided set, non-marking tennis shoes, and a valid ID.',
                'restrictions'         => 'No food or drinks on the court. Non-marking shoes only — no street shoes, cleats, or sandals.',
                'excessive_mess_fee'   => 500.00,
                'damage_clearance_fee' => 1000.00,
            ],
        ];

        foreach ($facilities as $facility) {
            Facility::create($facility);
        }
    }
}
