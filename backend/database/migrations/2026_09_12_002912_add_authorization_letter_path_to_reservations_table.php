<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            // Stored on the *private* local disk (not storage/app/public like facility
            // images) — served through an authenticated download route, since this can
            // be a personally-identifying document, not something to expose via a
            // guessable public URL.
            $table->string('authorization_letter_path')->nullable()->after('selected_amenities');
        });
    }

    public function down(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->dropColumn('authorization_letter_path');
        });
    }
};
