<?php

namespace App\Models;

use CodeIgniter\Model;

class AccessRequestModel extends Model
{
    protected $table         = 'access_requests';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = true;

    protected $allowedFields = [
        'user_id', 'resource_type', 'resource_id', 'resource_name',
        'action', 'reason', 'status',
        'reviewed_by', 'reviewed_at', 'review_notes', 'expires_at',
    ];

    public function forUser(int $userId, int $limit = 20): array
    {
        return $this->select("access_requests.*,
                              CONCAT(r.first_name,' ',r.last_name) AS reviewer_name")
                    ->join('users r', 'r.id = access_requests.reviewed_by', 'left')
                    ->where('access_requests.user_id', $userId)
                    ->orderBy('created_at', 'DESC')
                    ->findAll($limit);
    }

    public function allPending(int $limit = 50): array
    {
        return $this->select("access_requests.*,
                              CONCAT(u.first_name,' ',u.last_name) AS user_name,
                              u.email AS user_email, u.role AS user_role")
                    ->join('users u', 'u.id = access_requests.user_id', 'left')
                    ->where('access_requests.status', 'pendiente')
                    ->orderBy('created_at', 'ASC')
                    ->findAll($limit);
    }

    public function allWithUsers(array $filters = [], int $limit = 50): array
    {
        $b = $this->select("access_requests.*,
                            CONCAT(u.first_name,' ',u.last_name) AS user_name,
                            u.email AS user_email, u.role AS user_role,
                            CONCAT(r.first_name,' ',r.last_name) AS reviewer_name")
                  ->join('users u', 'u.id = access_requests.user_id', 'left')
                  ->join('users r', 'r.id = access_requests.reviewed_by', 'left');

        if (!empty($filters['status'])) $b->where('access_requests.status', $filters['status']);
        if (!empty($filters['user_id'])) $b->where('access_requests.user_id', (int)$filters['user_id']);

        return $b->orderBy('access_requests.created_at', 'DESC')->findAll($limit);
    }

    /** Check if user has an active approved grant for a given action+resource */
    public function hasActiveGrant(int $userId, string $resourceType, string $action, ?int $resourceId = null): bool
    {
        $b = $this->where('user_id', $userId)
                  ->where('status', 'aprobado')
                  ->where('resource_type', $resourceType)
                  ->where('action', $action)
                  ->groupStart()
                    ->where('expires_at IS NULL', null, false)
                    ->orWhere('expires_at >', date('Y-m-d H:i:s'))
                  ->groupEnd();

        if ($resourceId !== null) {
            $b->groupStart()->where('resource_id', $resourceId)->orWhere('resource_id IS NULL', null, false)->groupEnd();
        }

        return $b->countAllResults() > 0;
    }
}
