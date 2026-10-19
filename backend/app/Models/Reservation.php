<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Reservation extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'facility_id',
        'reservation_group_id',
        'purpose',
        'event_package',
        'waste_management_plan',
        'crowd_management_plan',
        'event_considerations',
        'crowd_management_confirmed',
        'waste_management_confirmed',
        'number_of_participants',
        'reservation_date',
        'start_time',
        'end_time',
        'status',
        'is_priority',
        'internal_note',
        'type',
        'admin_note',
        'reviewed_by',
        'reviewed_at',
        'selected_amenities',
        'amenity_quantities',
        'terms_acknowledged',
        'terms_acknowledged_at',
        'authorization_letter_path',
        'request_letter_path',
    ];

    protected function casts(): array
    {
        return [
            'selected_amenities' => 'array',
            'amenity_quantities' => 'array',
            'terms_acknowledged' => 'boolean',
            'is_priority' => 'boolean',
            'crowd_management_confirmed' => 'boolean',
            'waste_management_confirmed' => 'boolean',
            'reservation_date' => 'date',
            'reviewed_at' => 'datetime',
            'terms_acknowledged_at' => 'datetime',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function facility()
    {
        return $this->belongsTo(Facility::class);
    }

    public function payment()
    {
        return $this->hasOne(Payment::class);
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
