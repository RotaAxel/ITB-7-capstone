<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('facilities', function (Blueprint $table) {
            // Minutes blocked immediately before AND after every reservation on this
            // facility, for cleaning/setup/teardown — a 2–3pm booking with a 30-minute
            // buffer actually blocks 1:30pm–3:30pm from any other reservation. Defaults
            // to 30 (a reasonable universal default) rather than 0, so every existing
            // facility gets this protection immediately rather than opting in later.
            $table->unsignedSmallInteger('buffer_minutes')->default(30)->after('capacity');
        });
    }

    public function down(): void
    {
        Schema::table('facilities', function (Blueprint $table) {
            $table->dropColumn('buffer_minutes');
        });
    }
};
