<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Facility extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'description',
        'location',
        'capacity',
        'buffer_minutes',
        'image_path',
        'price_per_hour',
        'resident_price_per_hour',
        'status',
        'maintenance_note',
        'maintenance_start',
        'maintenance_end',
        'requires_authorization_letter',
        'requires_request_letter',
        'what_to_bring',
        'restrictions',
        'additional_terms',
        'excessive_mess_fee',
        'damage_clearance_fee',
    ];

    protected function casts(): array
    {
        return [
            'maintenance_start' => 'date',
            'maintenance_end' => 'date',
            'price_per_hour' => 'decimal:2',
            'resident_price_per_hour' => 'decimal:2',
            'requires_authorization_letter' => 'boolean',
            'requires_request_letter' => 'boolean',
            'excessive_mess_fee' => 'decimal:2',
            'damage_clearance_fee' => 'decimal:2',
        ];
    }

    public function amenities()
    {
        return $this->hasMany(Amenity::class);
    }

    public function reservations()
    {
        return $this->hasMany(Reservation::class);
    }

    public function maintenanceLogs()
    {
        return $this->hasMany(MaintenanceLog::class);
    }

    public function scopeAvailable($query)
    {
        return $query->where('status', 'available');
    }

    // resident_price_per_hour is an optional discount — a verified Cabuyeño
    // resident pays it when set; everyone else (and every facility without one
    // configured) pays the standard price_per_hour, same as before this existed.
    public function rateFor(?User $user): float
    {
        if ($user && $user->isVerifiedResident() && $this->resident_price_per_hour !== null) {
            return (float) $this->resident_price_per_hour;
        }

        return (float) $this->price_per_hour;
    }
}
