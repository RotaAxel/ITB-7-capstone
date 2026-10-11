<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            // Distinct from `admin_note`, which is the client-facing rejection
            // reason — this is for staff/admin's own internal reference (e.g. "VIP —
            // mayor's office event") and is never shown to the client.
            $table->boolean('is_priority')->default(false)->after('status');
            $table->text('internal_note')->nullable()->after('is_priority');
        });
    }

    public function down(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->dropColumn(['is_priority', 'internal_note']);
        });
    }
};
