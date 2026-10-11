<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Cabuyeño (Cabuyao resident) pricing — see Facility::resident_price_per_hour.
            // 'unverified' is the default and what a non-resident stays at forever;
            // uploading proof doesn't grant the discount by itself, only an admin
            // marking it 'verified' does.
            $table->string('residency_proof_path')->nullable()->after('contact_number');
            $table->enum('residency_status', ['unverified', 'pending', 'verified', 'rejected'])
                ->default('unverified')->after('residency_proof_path');
            $table->text('residency_admin_note')->nullable()->after('residency_status');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['residency_proof_path', 'residency_status', 'residency_admin_note']);
        });
    }
};
