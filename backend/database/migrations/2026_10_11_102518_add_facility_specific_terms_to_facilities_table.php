<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('facilities', function (Blueprint $table) {
            // All nullable/free-text — an admin fills these in per facility from the
            // Facilities form; a facility with none of these set just shows the
            // system-wide generic terms with no facility-specific section, rather
            // than forcing every facility to have one.
            $table->text('what_to_bring')->nullable()->after('requires_authorization_letter');
            $table->text('restrictions')->nullable()->after('what_to_bring');
            $table->text('additional_terms')->nullable()->after('restrictions');

            // Disclosed, not auto-charged — assessed after a post-event facility
            // inspection, which this system doesn't automate. Shown in the terms the
            // client agrees to and on the facility page so it's never a surprise, but
            // never added to the reservation's payable amount up front.
            $table->decimal('excessive_mess_fee', 10, 2)->nullable()->after('additional_terms');
            $table->decimal('damage_clearance_fee', 10, 2)->nullable()->after('excessive_mess_fee');
        });
    }

    public function down(): void
    {
        Schema::table('facilities', function (Blueprint $table) {
            $table->dropColumn([
                'what_to_bring',
                'restrictions',
                'additional_terms',
                'excessive_mess_fee',
                'damage_clearance_fee',
            ]);
        });
    }
};
