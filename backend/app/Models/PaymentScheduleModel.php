<?php

namespace App\Models;

use CodeIgniter\Model;

class PaymentScheduleModel extends Model
{
    protected $table         = 'payment_schedules';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = true;

    protected $allowedFields = [
        'project_id', 'concept', 'amount', 'due_date',
        'status', 'paid_at', 'milestone_id', 'notes', 'created_by',
    ];

    public function forProject(int $projectId): array
    {
        return $this->select('payment_schedules.*, milestones.title AS milestone_title')
                    ->join('milestones', 'milestones.id = payment_schedules.milestone_id', 'left')
                    ->where('project_id', $projectId)
                    ->orderBy('due_date')
                    ->findAll();
    }

    /** Auto-mark overdue payments (call from controller or command) */
    public function markOverdue(): int
    {
        return $this->db->query(
            "UPDATE payment_schedules SET status='atrasado'
             WHERE status='pendiente' AND due_date < CURDATE()"
        )->affected_rows ?? 0;
    }

    public function summary(int $projectId): array
    {
        $db = \Config\Database::connect();
        return $db->query("
            SELECT
                COALESCE(SUM(amount),0)                                        AS total,
                COALESCE(SUM(CASE WHEN status='pagado'    THEN amount ELSE 0 END),0) AS pagado,
                COALESCE(SUM(CASE WHEN status='pendiente' THEN amount ELSE 0 END),0) AS pendiente,
                COALESCE(SUM(CASE WHEN status='atrasado'  THEN amount ELSE 0 END),0) AS atrasado,
                COUNT(*)                                                        AS total_count,
                SUM(CASE WHEN status='pagado' THEN 1 ELSE 0 END)               AS pagado_count
            FROM payment_schedules WHERE project_id = ?
        ", [$projectId])->getRowArray() ?? [];
    }
}
