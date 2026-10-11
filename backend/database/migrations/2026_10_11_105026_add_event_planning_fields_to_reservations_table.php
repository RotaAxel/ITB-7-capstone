<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            // Required only for large events (see ReservationController's
            // LARGE_EVENT_THRESHOLD) — nullable so a small reservation's form never
            // needs them and existing rows don't break.
            $table->text('waste_management_plan')->nullable()->after('purpose');
            $table->text('crowd_management_plan')->nullable()->after('waste_management_plan');
            $table->text('event_considerations')->nullable()->after('crowd_management_plan');
        });
    }

    public function down(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->dropColumn(['waste_management_plan', 'crowd_management_plan', 'event_considerations']);
        });
    }
};
