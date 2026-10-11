<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('facilities', function (Blueprint $table) {
            // Independent of requires_authorization_letter — a "Request Letter" is
            // the formal letter requesting use of the facility itself (addressed to
            // CABS/City Hall); an "Authorization Letter" is a separate document only
            // needed when the person booking isn't the actual event organizer. A
            // facility can require either, both, or neither.
            $table->boolean('requires_request_letter')->default(false)->after('requires_authorization_letter');
        });
    }

    public function down(): void
    {
        Schema::table('facilities', function (Blueprint $table) {
            $table->dropColumn('requires_request_letter');
        });
    }
};
