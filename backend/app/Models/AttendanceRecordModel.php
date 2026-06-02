<?php

namespace App\Models;

use CodeIgniter\Model;

class AttendanceRecordModel extends Model
{
    protected $table         = 'attendance_records';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = true;

    protected $allowedFields = [
        'user_id', 'location_id',
        'check_in_at', 'check_in_lat', 'check_in_lng', 'check_in_dist_m', 'check_in_valid',
        'check_out_at', 'check_out_lat', 'check_out_lng', 'check_out_dist_m', 'check_out_valid',
        'notes', 'status',
    ];

    /** Return the open (not checked-out) record for a user, or null. */
    public function openRecord(int $userId): ?array
    {
        return $this->where('user_id', $userId)
                    ->where('status', 'open')
                    ->orderBy('check_in_at', 'DESC')
                    ->first();
    }

    /** Paginated list for a single user. */
    public function forUser(int $userId, int $limit = 30, int $offset = 0): array
    {
        return $this->select('attendance_records.*, attendance_locations.name AS location_name')
                    ->join('attendance_locations', 'attendance_locations.id = attendance_records.location_id', 'left')
                    ->where('attendance_records.user_id', $userId)
                    ->orderBy('check_in_at', 'DESC')
                    ->findAll($limit, $offset);
    }

    /** Admin: all records with user and location info. */
    public function allWithDetails(array $filters = [], int $limit = 50, int $offset = 0): array
    {
        $b = $this->select('attendance_records.*, attendance_locations.name AS location_name, users.name AS user_name, users.email AS user_email')
                  ->join('attendance_locations', 'attendance_locations.id = attendance_records.location_id', 'left')
                  ->join('users', 'users.id = attendance_records.user_id', 'left');

        if (!empty($filters['user_id'])) {
            $b->where('attendance_records.user_id', (int) $filters['user_id']);
        }
        if (!empty($filters['date_from'])) {
            $b->where('DATE(check_in_at) >=', $filters['date_from']);
        }
        if (!empty($filters['date_to'])) {
            $b->where('DATE(check_in_at) <=', $filters['date_to']);
        }
        if (!empty($filters['location_id'])) {
            $b->where('attendance_records.location_id', (int) $filters['location_id']);
        }

        return $b->orderBy('check_in_at', 'DESC')->findAll($limit, $offset);
    }
}
