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
        $b = $this->select('attendance_records.*, attendance_locations.name AS location_name, users.name AS user_name, users.email AS user_email, users.first_name, users.last_name')
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
        if (isset($filters['status']) && $filters['status'] !== '') {
            $b->where('attendance_records.status', $filters['status']);
        }
        if (isset($filters['geo_valid']) && $filters['geo_valid'] !== '') {
            $b->where('check_in_valid', (int) $filters['geo_valid']);
        }

        return $b->orderBy('check_in_at', 'DESC')->findAll($limit, $offset);
    }

    /** Count all records with same filters (for pagination). */
    public function countWithDetails(array $filters = []): int
    {
        $b = $this->select('COUNT(*) as cnt')
                  ->join('attendance_locations', 'attendance_locations.id = attendance_records.location_id', 'left')
                  ->join('users', 'users.id = attendance_records.user_id', 'left');

        if (!empty($filters['user_id']))     $b->where('attendance_records.user_id', (int) $filters['user_id']);
        if (!empty($filters['date_from']))   $b->where('DATE(check_in_at) >=', $filters['date_from']);
        if (!empty($filters['date_to']))     $b->where('DATE(check_in_at) <=', $filters['date_to']);
        if (!empty($filters['location_id'])) $b->where('attendance_records.location_id', (int) $filters['location_id']);
        if (isset($filters['status']) && $filters['status'] !== '') $b->where('attendance_records.status', $filters['status']);
        if (isset($filters['geo_valid']) && $filters['geo_valid'] !== '') $b->where('check_in_valid', (int) $filters['geo_valid']);

        $r = $b->first();
        return (int) ($r['cnt'] ?? 0);
    }

    /** Who is currently checked in (open records with user info). */
    public function presentNow(): array
    {
        return $this->select('attendance_records.*, users.name AS user_name, users.email AS user_email, users.first_name, users.last_name, attendance_locations.name AS location_name')
                    ->join('users', 'users.id = attendance_records.user_id', 'left')
                    ->join('attendance_locations', 'attendance_locations.id = attendance_records.location_id', 'left')
                    ->where('attendance_records.status', 'open')
                    ->orderBy('check_in_at', 'ASC')
                    ->findAll();
    }

    /** Stats for today (admin dashboard). */
    public function todayStats(): array
    {
        $today = date('Y-m-d');
        $db    = \Config\Database::connect();

        $total = $db->query("SELECT COUNT(*) AS c FROM attendance_records WHERE DATE(check_in_at) = ?", [$today])->getRow()->c ?? 0;
        $open  = $db->query("SELECT COUNT(*) AS c FROM attendance_records WHERE status = 'open'")->getRow()->c ?? 0;
        $geo_ok = $db->query("SELECT COUNT(*) AS c FROM attendance_records WHERE DATE(check_in_at) = ? AND check_in_valid = 1", [$today])->getRow()->c ?? 0;
        $geo_fail = $db->query("SELECT COUNT(*) AS c FROM attendance_records WHERE DATE(check_in_at) = ? AND check_in_lat IS NOT NULL AND check_in_valid = 0", [$today])->getRow()->c ?? 0;

        // Avg hours for closed records today
        $avgRow = $db->query("
            SELECT AVG(TIMESTAMPDIFF(SECOND, check_in_at, check_out_at)) AS avg_sec
            FROM attendance_records
            WHERE DATE(check_in_at) = ? AND status IN ('closed','manual') AND check_out_at IS NOT NULL
        ", [$today])->getRow();
        $avgSec = (float) ($avgRow->avg_sec ?? 0);

        return [
            'total_today'    => (int) $total,
            'present_now'    => (int) $open,
            'geo_valid'      => (int) $geo_ok,
            'geo_violations' => (int) $geo_fail,
            'avg_hours_today'=> $avgSec > 0 ? round($avgSec / 3600, 2) : null,
        ];
    }
}
