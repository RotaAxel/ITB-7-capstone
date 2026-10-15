<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Amenity extends Model
{
    use HasFactory;

    protected $fillable = [
        'facility_id',
        'name',
        'description',
        'quantity',
        'fee',
        'is_quantifiable',
        'is_available',
    ];

    // The hard ceiling on how many units of a quantifiable amenity (chairs,
    // tables, ...) a single reservation can request, regardless of how high an
    // admin sets this amenity's own stock `quantity`.
    public const MAX_QUANTITY_PER_RESERVATION = 1000;

    protected function casts(): array
    {
        return [
            'is_available' => 'boolean',
            'is_quantifiable' => 'boolean',
            'fee' => 'decimal:2',
        ];
    }

    public function facility()
    {
        return $this->belongsTo(Facility::class);
    }
}
