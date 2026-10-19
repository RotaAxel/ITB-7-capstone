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
        Schema::table('facilities', function (Blueprint $table) {
            // How many full days before AND after a large event (see
            // ReservationController::LARGE_EVENT_THRESHOLD) are blocked
            // entirely for this facility — no other reservation of any size
            // can land on those days. Distinct from buffer_minutes, which only
            // pads a same-day time window; this blocks whole calendar days,
            // for the extended setup/teardown a large event needs.
            $table->unsignedTinyInteger('large_event_buffer_days')->default(1)->after('buffer_minutes');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('facilities', function (Blueprint $table) {
            $table->dropColumn('large_event_buffer_days');
        });
    }
};
