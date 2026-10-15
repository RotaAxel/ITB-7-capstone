<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            // Map of amenity_id => requested quantity, only populated for
            // quantifiable amenities (see Amenity::is_quantifiable) the client
            // selected — e.g. {"4": 85} for 85 chairs. selected_amenities (the
            // existing plain array of amenity IDs) is unchanged and still the
            // source of truth for *which* amenities were picked; this only answers
            // "how many" for the ones where that question applies.
            $table->json('amenity_quantities')->nullable()->after('selected_amenities');
        });
    }

    public function down(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->dropColumn('amenity_quantities');
        });
    }
};
