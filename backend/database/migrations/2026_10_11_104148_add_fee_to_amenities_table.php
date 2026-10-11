<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('amenities', function (Blueprint $table) {
            // Flat additional charge for selecting this amenity on a reservation —
            // not multiplied by `quantity` (that column is the facility's stock count,
            // not something the client chooses a number of). Defaults to 0 so every
            // existing amenity stays free until an admin sets a fee on it.
            $table->decimal('fee', 10, 2)->default(0)->after('quantity');
        });
    }

    public function down(): void
    {
        Schema::table('amenities', function (Blueprint $table) {
            $table->dropColumn('fee');
        });
    }
};
