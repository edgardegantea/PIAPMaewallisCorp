<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use App\Libraries\Auth;
use App\Models\AttendanceLocationModel;
use App\Models\AttendanceRecordModel;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Attendance module with geolocation verification.
 *
 * LOCATIONS (admin):
 *   GET    /api/attendance/locations
 *   POST   /api/attendance/locations
 *   PATCH  /api/attendance/locations/:id
 *   DELETE /api/attendance/locations/:id
 *
 * USER:
 *   GET    /api/attendance/status        – current open record
 *   POST   /api/attendance/check-in
 *   POST   /api/attendance/check-out
 *   GET    /api/attendance/my            – own history
 *
 * ADMIN:
 *   GET    /api/attendance/records       – all records (filterable)
 *   PATCH  /api/attendance/records/:id  – manual correction
 */
class AttendanceController extends BaseController
{
    private AttendanceLocationModel $locations;
    private AttendanceRecordModel   $records;

    public function __construct()
    {
        $this->locations = new AttendanceLocationModel();
        $this->records   = new AttendanceRecordModel();
    }

    // ── Locations (admin) ─────────────────────────────────────────────────────

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
            'is_active'  => 1,
            'created_by' => Auth::id(),
        ]);

        return $this->response->setStatusCode(201)->setJSON($this->locations->find($id));
    }

    public function updateLocation(int $id): ResponseInterface
    {
        $loc  = $this->locations->find($id);
        if (!$loc) {
            return $this->response->setStatusCode(404)->setJSON(['message' => 'Ubicación no encontrada']);
        }

        $data    = $this->request->getJSON(true) ?: $this->request->getPost();
        $allowed = [];

        if (isset($data['name']))      $allowed['name']      = mb_substr(trim((string) $data['name']), 0, 150);
        if (isset($data['address']))   $allowed['address']   = mb_substr(trim((string) $data['address']), 0, 255);
        if (isset($data['latitude']))  $allowed['latitude']  = (float) $data['latitude'];
        if (isset($data['longitude'])) $allowed['longitude'] = (float) $data['longitude'];
        if (isset($data['radius_m']))  $allowed['radius_m']  = max(10, (int) $data['radius_m']);
        if (isset($data['is_active'])) $allowed['is_active'] = (int) (bool) $data['is_active'];

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

    // ── User: status + check-in / check-out ───────────────────────────────────

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

        $data = $this->request->getJSON(true) ?: $this->request->getPost();

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

        $distM = null;
        $valid = false;

        if ($userLat !== null && $userLng !== null) {
            $distM = (int) round($this->haversineM(
                $userLat, $userLng,
                (float) $location['latitude'],
                (float) $location['longitude']
            ));
            $valid = $distM <= (int) $location['radius_m'];
        }

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
            'record'    => $record,
            'geo_valid' => $valid,
            'distance_m'=> $distM,
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

        $distM = null;
        $valid = false;

        if ($userLat !== null && $userLng !== null && $location) {
            $distM = (int) round($this->haversineM(
                $userLat, $userLng,
                (float) $location['latitude'],
                (float) $location['longitude']
            ));
            $valid = $distM <= (int) $location['radius_m'];
        }

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

    /** Own history */
    public function myRecords(): ResponseInterface
    {
        $limit  = min(100, max(1, (int) ($this->request->getGet('limit')  ?? 30)));
        $offset = max(0, (int) ($this->request->getGet('offset') ?? 0));

        return $this->response->setJSON($this->records->forUser(Auth::id(), $limit, $offset));
    }

    // ── Admin: all records ────────────────────────────────────────────────────

    public function allRecords(): ResponseInterface
    {
        $filters = [
            'user_id'     => $this->request->getGet('user_id'),
            'location_id' => $this->request->getGet('location_id'),
            'date_from'   => $this->request->getGet('date_from'),
            'date_to'     => $this->request->getGet('date_to'),
        ];
        $limit  = min(200, max(1, (int) ($this->request->getGet('limit')  ?? 50)));
        $offset = max(0, (int) ($this->request->getGet('offset') ?? 0));

        return $this->response->setJSON($this->records->allWithDetails($filters, $limit, $offset));
    }

    /** Admin: manual correction of a record */
    public function updateRecord(int $id): ResponseInterface
    {
        $record = $this->records->find($id);
        if (!$record) {
            return $this->response->setStatusCode(404)->setJSON(['message' => 'Registro no encontrado']);
        }

        $data    = $this->request->getJSON(true) ?: $this->request->getPost();
        $allowed = [];

        if (isset($data['check_in_at']))  $allowed['check_in_at']  = date('Y-m-d H:i:s', strtotime($data['check_in_at']));
        if (isset($data['check_out_at'])) $allowed['check_out_at'] = date('Y-m-d H:i:s', strtotime($data['check_out_at']));
        if (isset($data['notes']))        $allowed['notes']         = mb_substr(trim((string) $data['notes']), 0, 500) ?: null;
        if (isset($data['status']))       $allowed['status']        = in_array($data['status'], ['open', 'closed', 'manual']) ? $data['status'] : $record['status'];

        $allowed['status'] = 'manual';

        $this->records->update($id, $allowed);
        return $this->response->setJSON($this->records->find($id));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Haversine formula → distance in metres between two lat/lng pairs. */
    private function haversineM(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $R   = 6371000; // Earth radius in metres
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a   = sin($dLat / 2) ** 2
             + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;
        return $R * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }
}
