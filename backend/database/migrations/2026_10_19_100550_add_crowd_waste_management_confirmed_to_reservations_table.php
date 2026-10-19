<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            // Replaces the old free-text waste_management_plan/crowd_management_plan
            // fields for large events (see ReservationController::LARGE_EVENT_THRESHOLD)
            // — instead of describing a plan, the client just checks a box confirming
            // they'll provide crowd/waste management, per the Terms & Conditions
            // clause covering it. The two old columns stay in place (untouched, for
            // any historical reservation that already has them filled in) but are no
            // longer written to by new reservations.
            $table->boolean('crowd_waste_management_confirmed')->default(false)->after('event_considerations');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->dropColumn('crowd_waste_management_confirmed');
        });
    }
};
