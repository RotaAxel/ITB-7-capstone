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
            // Split from the single crowd_waste_management_confirmed column —
            // crowd management and waste management are now confirmed (and
            // shown in the Terms & Conditions) as two independent checkboxes.
            $table->boolean('crowd_management_confirmed')->default(false)->after('event_considerations');
            $table->boolean('waste_management_confirmed')->default(false)->after('crowd_management_confirmed');
            $table->dropColumn('crowd_waste_management_confirmed');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->boolean('crowd_waste_management_confirmed')->default(false)->after('event_considerations');
            $table->dropColumn(['crowd_management_confirmed', 'waste_management_confirmed']);
        });
    }
};
