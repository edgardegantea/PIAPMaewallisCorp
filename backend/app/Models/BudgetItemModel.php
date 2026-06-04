<?php

namespace App\Models;

use CodeIgniter\Model;

class BudgetItemModel extends Model
{
    protected $table         = 'budget_items';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = true;

    protected $allowedFields = [
        'project_id', 'category', 'description',
        'planned_amount', 'actual_amount', 'date', 'notes', 'created_by',
    ];

    public function forProject(int $projectId): array
    {
        return $this->select('budget_items.*, CONCAT(u.first_name," ",u.last_name) AS created_by_name')
                    ->join('users u', 'u.id = budget_items.created_by', 'left')
                    ->where('project_id', $projectId)
                    ->orderBy('category')->orderBy('created_at')
                    ->findAll();
    }

    public function summaryByCategory(int $projectId): array
    {
        $db = \Config\Database::connect();
        return $db->query("
            SELECT category,
                   COALESCE(SUM(planned_amount),0) AS planned,
                   COALESCE(SUM(actual_amount),0)  AS actual,
                   COUNT(*) AS items
            FROM budget_items
            WHERE project_id = ?
            GROUP BY category
            ORDER BY category
        ", [$projectId])->getResultArray();
    }
}
