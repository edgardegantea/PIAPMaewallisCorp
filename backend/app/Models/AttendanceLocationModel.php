<?php

namespace App\Models;

use CodeIgniter\Model;

class AttendanceLocationModel extends Model
{
    protected $table         = 'attendance_locations';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = true;

    protected $allowedFields = [
        'name', 'address', 'latitude', 'longitude', 'radius_m', 'is_active', 'created_by',
    ];

    public function active(): array
    {
        return $this->where('is_active', 1)->orderBy('name')->findAll();
    }
}
