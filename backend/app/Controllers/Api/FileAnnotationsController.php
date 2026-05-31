<?php
namespace App\Controllers\Api;
use App\Controllers\BaseController;
use App\Libraries\Auth;
use CodeIgniter\HTTP\ResponseInterface;
use Config\Database;

/**
 * FileAnnotationsController — Anotaciones en documentos (x/y coords + cuerpo + resolución)
 */
class FileAnnotationsController extends BaseController
{
    /** GET /documents/:docId/annotations */
    public function index(int $docId): ResponseInterface
    {
        $rows = Database::connect()
            ->table('file_annotations fa')
            ->select('fa.*, u.first_name, u.last_name')
            ->join('users u', 'u.id = fa.user_id', 'left')
            ->where('fa.document_id', $docId)
            ->orderBy('fa.created_at', 'ASC')
            ->get()->getResultArray();
        return $this->response->setJSON($rows);
    }

    /** POST /documents/:docId/annotations */
    public function create(int $docId): ResponseInterface
    {
        $db   = Database::connect();
        $data = $this->request->getJSON(true);

        if (empty($data['body'])) {
            return $this->response->setStatusCode(422)->setJSON(['message' => 'El cuerpo de la anotación es obligatorio']);
        }

        $db->table('file_annotations')->insert([
            'document_id' => $docId,
            'user_id'     => Auth::id(),
            'x_coord'     => $data['x_coord'] ?? null,
            'y_coord'     => $data['y_coord'] ?? null,
            'page'        => $data['page']    ?? 1,
            'body'        => $data['body'],
            'is_resolved' => 0,
            'created_at'  => date('Y-m-d H:i:s'),
        ]);

        $id  = $db->insertID();
        $row = $db->table('file_annotations fa')
            ->select('fa.*, u.first_name, u.last_name')
            ->join('users u', 'u.id = fa.user_id', 'left')
            ->where('fa.id', $id)
            ->get()->getRowArray();

        return $this->response->setStatusCode(201)->setJSON($row);
    }

    /** PATCH /annotations/:id */
    public function update(int $id): ResponseInterface
    {
        $db   = Database::connect();
        $data = $this->request->getJSON(true);
        $allowed = ['body', 'x_coord', 'y_coord', 'page'];
        $payload = array_intersect_key($data, array_flip($allowed));

        if (empty($payload)) {
            return $this->response->setStatusCode(422)->setJSON(['message' => 'Sin campos para actualizar']);
        }

        // Only the author can edit
        $ann = $db->table('file_annotations')->where('id', $id)->get()->getRowArray();
        if (!$ann) return $this->response->setStatusCode(404)->setJSON(['message' => 'Anotación no encontrada']);
        if ((int)$ann['user_id'] !== Auth::id()) {
            return $this->response->setStatusCode(403)->setJSON(['message' => 'No autorizado']);
        }

        $db->table('file_annotations')->where('id', $id)->update($payload);
        return $this->response->setJSON($db->table('file_annotations')->where('id', $id)->get()->getRowArray());
    }

    /** PATCH /annotations/:id/resolve */
    public function resolve(int $id): ResponseInterface
    {
        $db  = Database::connect();
        $ann = $db->table('file_annotations')->where('id', $id)->get()->getRowArray();
        if (!$ann) return $this->response->setStatusCode(404)->setJSON(['message' => 'Anotación no encontrada']);

        $db->table('file_annotations')->where('id', $id)->update([
            'is_resolved'  => 1,
            'resolved_by'  => Auth::id(),
            'resolved_at'  => date('Y-m-d H:i:s'),
        ]);
        return $this->response->setJSON(['message' => 'Anotación resuelta']);
    }

    /** DELETE /annotations/:id */
    public function delete(int $id): ResponseInterface
    {
        $db  = Database::connect();
        $ann = $db->table('file_annotations')->where('id', $id)->get()->getRowArray();
        if (!$ann) return $this->response->setStatusCode(404)->setJSON(['message' => 'No encontrada']);

        // Only author or admin can delete
        $user = Auth::user();
        if ((int)$ann['user_id'] !== Auth::id() && !in_array($user['role'] ?? '', ['ADMIN','DIRECTOR'])) {
            return $this->response->setStatusCode(403)->setJSON(['message' => 'No autorizado']);
        }

        $db->table('file_annotations')->where('id', $id)->delete();
        return $this->response->setStatusCode(204)->setBody('');
    }
}
