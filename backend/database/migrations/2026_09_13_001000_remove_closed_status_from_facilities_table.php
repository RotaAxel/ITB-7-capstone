<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// "Closed" was redundant with "Unavailable" as a facility status — this collapses
// any existing 'closed' facilities into 'unavailable' and drops it from the enum.
return new class extends Migration
{
    public function up(): void
    {
        DB::table('facilities')->where('status', 'closed')->update(['status' => 'unavailable']);
        DB::statement("ALTER TABLE facilities MODIFY status ENUM('available', 'under_maintenance', 'unavailable') NOT NULL DEFAULT 'available'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE facilities MODIFY status ENUM('available', 'under_maintenance', 'unavailable', 'closed') NOT NULL DEFAULT 'available'");
    }
};
