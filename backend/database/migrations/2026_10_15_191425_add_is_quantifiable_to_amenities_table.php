<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('amenities', function (Blueprint $table) {
            // Most amenities are just toggled on/off (one sound system, one
            // scoreboard) and `fee` is a flat per-selection charge. A quantifiable
            // amenity (chairs, tables) instead lets the client pick how many they
            // need — `fee` then means "per unit", and `quantity` (the facility's
            // stock) doubles as the ceiling on how many a client can request,
            // itself capped at 1000 (see ReservationController).
            $table->boolean('is_quantifiable')->default(false)->after('fee');
        });
    }

    public function down(): void
    {
        Schema::table('amenities', function (Blueprint $table) {
            $table->dropColumn('is_quantifiable');
        });
    }
};
