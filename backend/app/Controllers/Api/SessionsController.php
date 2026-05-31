<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use App\Libraries\Auth;
use CodeIgniter\HTTP\ResponseInterface;
use Config\Database;

/**
 * User session history.
 *
 * GET    /api/sessions          active sessions for current user
 * DELETE /api/sessions/:id      revoke a specific session
 * DELETE /api/sessions          revoke all sessions except current
 */
class SessionsController extends BaseController
{
    public function index(): ResponseInterface
    {
        $db   = Database::connect();
        $rows = $db->query("
            SELECT id, ip_address, user_agent, device, last_active, created_at, revoked
            FROM user_sessions
            WHERE user_id = ? AND revoked = 0
            ORDER BY last_active DESC
            LIMIT 20
        ", [Auth::id()])->getResultArray();

        return $this->response->setJSON($rows);
    }

    public function revoke(int $id): ResponseInterface
    {
        $db = Database::connect();
        $db->table('user_sessions')
            ->where('id', $id)->where('user_id', Auth::id())
            ->update(['revoked' => 1]);
        return $this->response->setStatusCode(204)->setBody('');
    }

    public function revokeAll(): ResponseInterface
    {
        $db = Database::connect();
        // Keep the most recent active session (current)
        $latest = $db->query(
            "SELECT id FROM user_sessions WHERE user_id = ? AND revoked = 0 ORDER BY last_active DESC LIMIT 1",
            [Auth::id()]
        )->getRowArray();

        $q = $db->table('user_sessions')->where('user_id', Auth::id())->where('revoked', 0);
        if ($latest) $q->where('id !=', $latest['id']);
        $q->update(['revoked' => 1]);

        return $this->response->setJSON(['message' => 'Sesiones cerradas']);
    }

    /** Call from Auth/LoginController to record a new session */
    public static function recordLogin(int $userId, string $tokenHash, ?string $ip, ?string $ua): void
    {
        try {
            $db     = Database::connect();
            $device = 'Desconocido';
            if ($ua) {
                if (preg_match('/Android|iPhone|iPad/i', $ua)) $device = 'Móvil';
                elseif (preg_match('/Windows/i', $ua))         $device = 'Windows';
                elseif (preg_match('/Mac OS/i', $ua))          $device = 'macOS';
                elseif (preg_match('/Linux/i', $ua))           $device = 'Linux';
            }
            $db->table('user_sessions')->insert([
                'user_id'     => $userId,
                'token_hash'  => $tokenHash,
                'ip_address'  => $ip,
                'user_agent'  => substr($ua ?? '', 0, 255),
                'device'      => $device,
                'last_active' => date('Y-m-d H:i:s'),
                'created_at'  => date('Y-m-d H:i:s'),
            ]);
        } catch (\Throwable $e) {
            log_message('error', 'SessionsController::recordLogin: ' . $e->getMessage());
        }
    }
}
