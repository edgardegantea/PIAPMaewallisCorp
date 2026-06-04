<?php

namespace App\Models;

use CodeIgniter\Model;

class LeaveRequestModel extends Model
{
    protected $table         = 'leave_requests';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = true;

    protected $allowedFields = [
        'user_id', 'type', 'start_date', 'end_date', 'days_count',
        'reason', 'status', 'reviewed_by', 'reviewed_at', 'review_notes',
    ];

    public function forUser(int $userId, int $limit = 30, int $offset = 0): array
    {
        return $this->where('user_id', $userId)
                    ->orderBy('start_date', 'DESC')
                    ->findAll($limit, $offset);
    }

    public function allWithUsers(array $filters = [], int $limit = 50, int $offset = 0): array
    {
        $b = $this->select("leave_requests.*,
                            CONCAT(u.first_name,' ',u.last_name) AS user_name,
                            u.email AS user_email, u.first_name, u.last_name,
                            CONCAT(r.first_name,' ',r.last_name) AS reviewer_name")
                  ->join('users u', 'u.id = leave_requests.user_id', 'left')
                  ->join('users r', 'r.id = leave_requests.reviewed_by', 'left');

        if (!empty($filters['user_id']))  $b->where('leave_requests.user_id', (int)$filters['user_id']);
        if (!empty($filters['status']))   $b->where('leave_requests.status', $filters['status']);
        if (!empty($filters['type']))     $b->where('leave_requests.type', $filters['type']);
        if (!empty($filters['date_from'])) $b->where('start_date >=', $filters['date_from']);
        if (!empty($filters['date_to']))   $b->where('end_date <=', $filters['date_to']);

        return $b->orderBy('leave_requests.created_at', 'DESC')->findAll($limit, $offset);
    }

    /** Approved leaves for a user in a date range (to detect absences in reports) */
    public function approvedInRange(int $userId, string $from, string $to): array
    {
        return $this->where('user_id', $userId)
                    ->where('status', 'aprobado')
                    ->where('start_date <=', $to)
                    ->where('end_date >=', $from)
                    ->findAll();
    }
}
