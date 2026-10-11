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
        'is_available',
    ];

    protected function casts(): array
    {
        return [
            'is_available' => 'boolean',
            'fee' => 'decimal:2',
        ];
    }

    public function facility()
    {
        return $this->belongsTo(Facility::class);
    }
}
