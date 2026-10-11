<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('facilities', function (Blueprint $table) {
            // Discounted rate for verified Cabuyeño residents (see
            // User::residency_status). Nullable — null means no resident discount
            // for this facility, so price_per_hour (the standard rate) applies to
            // everyone, same as before this column existed.
            $table->decimal('resident_price_per_hour', 10, 2)->nullable()->after('price_per_hour');
        });
    }

    public function down(): void
    {
        Schema::table('facilities', function (Blueprint $table) {
            $table->dropColumn('resident_price_per_hour');
        });
    }
};
