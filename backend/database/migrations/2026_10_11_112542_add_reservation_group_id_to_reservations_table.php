<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            // Ties together several Reservation rows (one per date) submitted as a
            // single multi-date request — e.g. "every Saturday in March". Each row
            // stays a fully independent, self-contained reservation (its own status,
            // payment, conflict checking, letters, etc.); this is only a shared tag
            // that lets the group be listed/approved/paid together. Null for every
            // ordinary single-date reservation — fully backward compatible.
            $table->uuid('reservation_group_id')->nullable()->after('facility_id')->index();
        });
    }

    public function down(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->dropColumn('reservation_group_id');
        });
    }
};
