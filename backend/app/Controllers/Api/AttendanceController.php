<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use App\Libraries\Auth;
use App\Models\AttendanceLocationModel;
use App\Models\AttendanceRecordModel;
use App\Models\UserModel;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Attendance module with geolocation verification.
 *
 * PUBLIC (auth):
 *   GET    /api/attendance/status           – current open record + active locations
 *   POST   /api/attendance/check-in
 *   POST   /api/attendance/check-out
 *   GET    /api/attendance/my              – own paginated history
 *   GET    /api/attendance/locations        – list all locations
 *
 * ADMIN (auth):
 *   GET    /api/attendance/records          – all records (filterable + paginated)
 *   GET    /api/attendance/today           – who's present now + today stats
 *   GET    /api/attendance/users-list      – all users for filter dropdown
 *   POST   /api/attendance/records         – create manual record for any user
 *   PATCH  /api/attendance/records/:id     – edit record
 *   DELETE /api/attendance/records/:id     – delete record
 *
 * ADMIN only (admin filter):
 *   POST   /api/admin/attendance/locations
 *   PATCH  /api/admin/attendance/locations/:id
 *   DELETE /api/admin/attendance/locations/:id
 */
class AttendanceController extends BaseController
{
    private AttendanceLocationModel $locations;
    private AttendanceRecordModel   $records;
    private UserModel               $users;

    public function __construct()
    {
        $this->locations = new AttendanceLocationModel();
        $this->records   = new AttendanceRecordModel();
        $this->users     = new UserModel();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // LOCATIONS
    // ─────────────────────────────────────────────────────────────────────────

    public function indexLocations(): ResponseInterface
    {
        return $this->response->setJSON($this->locations->orderBy('name')->findAll());
    }

    public function createLocation(): ResponseInterface
    {
        $data = $this->request->getJSON(true) ?: $this->request->getPost();

        $name = trim((string) ($data['name'] ?? ''));
        $lat  = isset($data['latitude'])  ? (float) $data['latitude']  : null;
        $lng  = isset($data['longitude']) ? (float) $data['longitude'] : null;

        if (!$name || $lat === null || $lng === null) {
            return $this->response->setStatusCode(422)
                ->setJSON(['message' => 'Nombre, latitud y longitud son obligatorios']);
        }

        $id = $this->locations->insert([
            'name'       => $name,
            'address'    => mb_substr(trim((string) ($data['address'] ?? '')), 0, 255) ?: null,
            'latitude'   => $lat,
            'longitude'  => $lng,
            'radius_m'   => max(10, (int) ($data['radius_m'] ?? 100)),
            'is_active'  => isset($data['is_active']) ? (int)(bool)$data['is_active'] : 1,
            'created_by' => Auth::id(),
        ]);

        return $this->response->setStatusCode(201)->setJSON($this->locations->find($id));
    }

    public function updateLocation(int $id): ResponseInterface
    {
        $loc = $this->locations->find($id);
        if (!$loc) {
            return $this->response->setStatusCode(404)->setJSON(['message' => 'Ubicación no encontrada']);
        }

        $data    = $this->request->getJSON(true) ?: $this->request->getPost();
        $allowed = [];

        if (isset($data['name']))      $allowed['name']      = mb_substr(trim((string) $data['name']), 0, 150);
        if (isset($data['address']))   $allowed['address']   = mb_substr(trim((string) $data['address']), 0, 255) ?: null;
        if (isset($data['latitude']))  $allowed['latitude']  = (float) $data['latitude'];
        if (isset($data['longitude'])) $allowed['longitude'] = (float) $data['longitude'];
        if (isset($data['radius_m']))  $allowed['radius_m']  = max(10, (int) $data['radius_m']);
        if (isset($data['is_active'])) $allowed['is_active'] = (int)(bool) $data['is_active'];

        if (empty($allowed)) {
            return $this->response->setStatusCode(422)->setJSON(['message' => 'Nada que actualizar']);
        }

        $this->locations->update($id, $allowed);
        return $this->response->setJSON($this->locations->find($id));
    }

    public function deleteLocation(int $id): ResponseInterface
    {
        if (!$this->locations->find($id)) {
            return $this->response->setStatusCode(404)->setJSON(['message' => 'Ubicación no encontrada']);
        }
        $this->locations->delete($id);
        return $this->response->setStatusCode(204)->setBody('');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // USER – check-in / check-out / status / my history
    // ─────────────────────────────────────────────────────────────────────────

    public function status(): ResponseInterface
    {
        $open = $this->records->openRecord(Auth::id());
        return $this->response->setJSON([
            'open'      => $open,
            'locations' => $this->locations->active(),
        ]);
    }

    public function checkIn(): ResponseInterface
    {
        $userId = Auth::id();

        if ($this->records->openRecord($userId)) {
            return $this->response->setStatusCode(409)
                ->setJSON(['message' => 'Ya tienes un registro de entrada abierto']);
        }

        $data       = $this->request->getJSON(true) ?: $this->request->getPost();
        $locationId = isset($data['location_id']) ? (int) $data['location_id'] : null;
        $userLat    = isset($data['latitude'])    ? (float) $data['latitude']  : null;
        $userLng    = isset($data['longitude'])   ? (float) $data['longitude'] : null;

        if (!$locationId) {
            return $this->response->setStatusCode(422)
                ->setJSON(['message' => 'Debes seleccionar una ubicación']);
        }

        $location = $this->locations->find($locationId);
        if (!$location || !$location['is_active']) {
            return $this->response->setStatusCode(422)
                ->setJSON(['message' => 'Ubicación inválida o inactiva']);
        }

        [$distM, $valid] = $this->calcGeo($userLat, $userLng, $location);

        $id = $this->records->insert([
            'user_id'         => $userId,
            'location_id'     => $locationId,
            'check_in_at'     => date('Y-m-d H:i:s'),
            'check_in_lat'    => $userLat,
            'check_in_lng'    => $userLng,
            'check_in_dist_m' => $distM,
            'check_in_valid'  => $valid ? 1 : 0,
            'notes'           => mb_substr(trim((string) ($data['notes'] ?? '')), 0, 500) ?: null,
            'status'          => 'open',
        ]);

        $record = $this->records->find($id);
        $record['location'] = $location;

        return $this->response->setStatusCode(201)->setJSON([
            'record'     => $record,
            'geo_valid'  => $valid,
            'distance_m' => $distM,
        ]);
    }

    public function checkOut(): ResponseInterface
    {
        $userId = Auth::id();
        $open   = $this->records->openRecord($userId);

        if (!$open) {
            return $this->response->setStatusCode(409)
                ->setJSON(['message' => 'No tienes un registro de entrada abierto']);
        }

        $data    = $this->request->getJSON(true) ?: $this->request->getPost();
        $userLat = isset($data['latitude'])  ? (float) $data['latitude']  : null;
        $userLng = isset($data['longitude']) ? (float) $data['longitude'] : null;

        $location = $open['location_id'] ? $this->locations->find($open['location_id']) : null;
        [$distM, $valid] = $this->calcGeo($userLat, $userLng, $location);

        $this->records->update($open['id'], [
            'check_out_at'     => date('Y-m-d H:i:s'),
            'check_out_lat'    => $userLat,
            'check_out_lng'    => $userLng,
            'check_out_dist_m' => $distM,
            'check_out_valid'  => $valid ? 1 : 0,
            'status'           => 'closed',
        ]);

        return $this->response->setJSON([
            'record'     => $this->records->find($open['id']),
            'geo_valid'  => $valid,
            'distance_m' => $distM,
        ]);
    }

    public function myRecords(): ResponseInterface
    {
        $limit  = min(100, max(1, (int) ($this->request->getGet('limit')  ?? 30)));
        $offset = max(0,           (int) ($this->request->getGet('offset') ?? 0));
        return $this->response->setJSON($this->records->forUser(Auth::id(), $limit, $offset));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ADMIN – full records access
    // ─────────────────────────────────────────────────────────────────────────

    /** GET /api/attendance/records — all records, filterable + paginated */
    public function allRecords(): ResponseInterface
    {
        $filters = $this->extractFilters();
        $limit   = min(200, max(1, (int) ($this->request->getGet('limit')  ?? 50)));
        $offset  = max(0,           (int) ($this->request->getGet('offset') ?? 0));

        return $this->response->setJSON([
            'data'  => $this->records->allWithDetails($filters, $limit, $offset),
            'total' => $this->records->countWithDetails($filters),
        ]);
    }

    /** GET /api/attendance/today — present-now list + today stats */
    public function today(): ResponseInterface
    {
        return $this->response->setJSON([
            'present' => $this->records->presentNow(),
            'stats'   => $this->records->todayStats(),
        ]);
    }

    /** GET /api/attendance/users-list — flat list for filter dropdowns */
    public function usersList(): ResponseInterface
    {
        $rows = $this->users
            ->select('id, username, email, first_name, last_name, is_active')
            ->where('is_active', 1)
            ->orderBy('first_name')
            ->findAll();
        return $this->response->setJSON($rows);
    }

    /** POST /api/attendance/records — admin creates a manual record for any user */
    public function createRecord(): ResponseInterface
    {
        $data = $this->request->getJSON(true) ?: $this->request->getPost();

        $userId     = isset($data['user_id'])     ? (int) $data['user_id']     : null;
        $locationId = isset($data['location_id']) ? (int) $data['location_id'] : null;
        $checkIn    = trim((string) ($data['check_in_at'] ?? ''));

        if (!$userId || !$checkIn) {
            return $this->response->setStatusCode(422)
                ->setJSON(['message' => 'Usuario y fecha/hora de entrada son obligatorios']);
        }

        if (!$this->users->find($userId)) {
            return $this->response->setStatusCode(422)->setJSON(['message' => 'Usuario no encontrado']);
        }

        $insert = [
            'user_id'        => $userId,
            'location_id'    => $locationId ?: null,
            'check_in_at'    => date('Y-m-d H:i:s', strtotime($checkIn)),
            'check_in_valid' => 0,
            'notes'          => mb_substr(trim((string) ($data['notes'] ?? '')), 0, 500) ?: null,
            'status'         => 'manual',
        ];

        if (!empty($data['check_out_at'])) {
            $insert['check_out_at']    = date('Y-m-d H:i:s', strtotime($data['check_out_at']));
            $insert['check_out_valid'] = 0;
        }

        $id = $this->records->insert($insert);
        return $this->response->setStatusCode(201)->setJSON($this->records->find($id));
    }

    /** PATCH /api/attendance/records/:id — admin edits any record */
    public function updateRecord(int $id): ResponseInterface
    {
        $record = $this->records->find($id);
        if (!$record) {
            return $this->response->setStatusCode(404)->setJSON(['message' => 'Registro no encontrado']);
        }

        $data    = $this->request->getJSON(true) ?: $this->request->getPost();
        $allowed = ['status' => 'manual'];

        if (isset($data['user_id']))      $allowed['user_id']      = (int) $data['user_id'];
        if (isset($data['location_id']))  $allowed['location_id']  = $data['location_id'] ? (int) $data['location_id'] : null;
        if (!empty($data['check_in_at'])) $allowed['check_in_at']  = date('Y-m-d H:i:s', strtotime($data['check_in_at']));
        if (array_key_exists('check_out_at', $data)) {
            $allowed['check_out_at'] = $data['check_out_at']
                ? date('Y-m-d H:i:s', strtotime($data['check_out_at']))
                : null;
        }
        if (array_key_exists('notes', $data)) {
            $allowed['notes'] = mb_substr(trim((string) $data['notes']), 0, 500) ?: null;
        }

        $this->records->update($id, $allowed);

        // Reload with joined data
        $updated = $this->records->allWithDetails(['user_id' => null], 1, 0);
        // Simple: just return base record
        return $this->response->setJSON($this->records->find($id));
    }

    /** DELETE /api/attendance/records/:id — admin deletes a record */
    public function deleteRecord(int $id): ResponseInterface
    {
        if (!$this->records->find($id)) {
            return $this->response->setStatusCode(404)->setJSON(['message' => 'Registro no encontrado']);
        }
        $this->records->delete($id);
        return $this->response->setStatusCode(204)->setBody('');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    private function extractFilters(): array
    {
        return [
            'user_id'     => $this->request->getGet('user_id'),
            'location_id' => $this->request->getGet('location_id'),
            'date_from'   => $this->request->getGet('date_from'),
            'date_to'     => $this->request->getGet('date_to'),
            'status'      => $this->request->getGet('status') ?? '',
            'geo_valid'   => $this->request->getGet('geo_valid') ?? '',
        ];
    }

    /** Returns [distanceMetres|null, isValid] for a user coordinate vs a location. */
    private function calcGeo(?float $lat, ?float $lng, ?array $location): array
    {
        if ($lat === null || $lng === null || !$location) {
            return [null, false];
        }
        $dist  = (int) round($this->haversineM($lat, $lng, (float)$location['latitude'], (float)$location['longitude']));
        $valid = $dist <= (int) $location['radius_m'];
        return [$dist, $valid];
    }

    /** Haversine formula → distance in metres. */
    private function haversineM(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $R    = 6371000;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a    = sin($dLat / 2) ** 2
              + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;
        return $R * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }
}
