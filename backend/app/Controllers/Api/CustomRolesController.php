<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use App\Libraries\Auth;
use CodeIgniter\HTTP\ResponseInterface;
use Config\Database;

/**
 * Custom RBAC roles.
 *
 * GET    /api/roles                  list all custom roles
 * POST   /api/roles                  { name, description, permissions{} }
 * PATCH  /api/roles/:id
 * DELETE /api/roles/:id
 * POST   /api/roles/:id/assign       { user_id }  — assign role to member
 */
class CustomRolesController extends BaseController
{
    /** Available permission keys */
    public const PERMISSIONS = [
        'projects.view', 'projects.edit', 'projects.delete',
        'tasks.view', 'tasks.create', 'tasks.edit', 'tasks.delete',
        'sprints.manage', 'backlog.manage',
        'members.manage', 'risks.manage', 'incidents.manage',
        'milestones.manage', 'documents.manage', 'technicaldocs.manage',
        'reports.view', 'audit.view', 'webhooks.manage',
        'budget.view', 'budget.edit',
    ];

    public function index(): ResponseInterface
    {
        $db   = Database::connect();
        $rows = $db->table('custom_roles')->orderBy('name')->get()->getResultArray();
        foreach ($rows as &$r) {
            $r['permissions'] = json_decode($r['permissions'] ?? '{}', true);
        }
        return $this->response->setJSON($rows);
    }

    public function create(): ResponseInterface
    {
        $db   = Database::connect();
        $data = $this->request->getJSON(true);
        if (empty($data['name'])) {
            return $this->response->setStatusCode(422)->setJSON(['message' => 'Nombre requerido']);
        }
        $db->table('custom_roles')->insert([
            'name'        => $data['name'],
            'description' => $data['description'] ?? null,
            'permissions' => json_encode($data['permissions'] ?? []),
            'created_at'  => date('Y-m-d H:i:s'),
        ]);
        return $this->response->setStatusCode(201)->setJSON(
            $db->table('custom_roles')->where('id', $db->insertID())->get()->getRowArray()
        );
    }

    public function update(int $id): ResponseInterface
    {
        $db   = Database::connect();
        $data = $this->request->getJSON(true);
        $payload = array_intersect_key($data, array_flip(['name','description','permissions']));
        if (isset($payload['permissions'])) $payload['permissions'] = json_encode($payload['permissions']);
        $db->table('custom_roles')->where('id', $id)->update($payload);
        return $this->response->setJSON($db->table('custom_roles')->where('id', $id)->get()->getRowArray());
    }

    public function delete(int $id): ResponseInterface
    {
        Database::connect()->table('custom_roles')->where('id', $id)->delete();
        return $this->response->setStatusCode(204)->setBody('');
    }

    public function getPermissionKeys(): ResponseInterface
    {
        return $this->response->setJSON(self::PERMISSIONS);
    }
}
