<?php

namespace Database\Seeders;

use App\Models\Facility;
use Illuminate\Database\Seeder;

class OpenFieldSeeder extends Seeder
{
    public function run(): void
    {
        // firstOrCreate, not create() — safe to re-run (e.g. alongside a fresh
        // migrate:fresh --seed) without duplicating the facility.
        Facility::firstOrCreate(
            ['name' => 'Open Field'],
            [
                'description'    => 'Large open-air multipurpose ground suitable for community events, sports festivals, assemblies, and other large-group activities that don\'t fit a standard court.',
                'location'       => 'Main Campus, Open Grounds',
                'capacity'       => 200,
                'price_per_hour' => 600.00,
                'status'         => 'available',
                'what_to_bring'        => 'Your own equipment/materials for your event, a valid ID, and your own waste disposal bags for cleanup.',
                'restrictions'         => 'No open flames or fireworks without prior written approval. Vehicles must park in designated areas only — no driving on the grass. Pets must be leashed at all times.',
                'additional_terms'     => 'Events with 100 or more participants must submit a waste management and crowd management plan at least 3 days before the event date.',
                'excessive_mess_fee'   => 2000.00,
                'damage_clearance_fee' => 4000.00,
            ]
        );

        $this->command?->info('Open Field facility seeded.');
    }
}
