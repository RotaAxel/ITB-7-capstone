<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('facilities', function (Blueprint $table) {
            // Per-facility toggle — not hardcoded to any one facility name, so an
            // admin can enable it on any facility from the Facilities form.
            $table->boolean('requires_authorization_letter')->default(false)->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('facilities', function (Blueprint $table) {
            $table->dropColumn('requires_authorization_letter');
        });
    }
};
