<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use App\Libraries\Auth;
use CodeIgniter\HTTP\ResponseInterface;
use Config\Database;

/**
 * Two-Factor Authentication (TOTP).
 * Uses RFC 6238 TOTP — compatible with Google Authenticator, Authy.
 *
 * GET  /api/2fa/setup    → generate QR URI + secret
 * POST /api/2fa/enable   { code } → verify and enable
 * POST /api/2fa/disable  { code } → verify and disable
 * POST /api/2fa/verify   { code } → verify during login (used by auth flow)
 */
class TwoFactorController extends BaseController
{
    /** Base32 alphabet */
    private const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

    private function generateSecret(int $length = 16): string
    {
        $secret = '';
        for ($i = 0; $i < $length; $i++) {
            $secret .= self::CHARS[random_int(0, 31)];
        }
        return $secret;
    }

    private function base32Decode(string $secret): string
    {
        $secret  = strtoupper(str_replace(' ', '', $secret));
        $buffer  = 0;
        $bits    = 0;
        $result  = '';
        for ($i = 0; $i < strlen($secret); $i++) {
            $val    = strpos(self::CHARS, $secret[$i]);
            if ($val === false) continue;
            $buffer = ($buffer << 5) | $val;
            $bits  += 5;
            if ($bits >= 8) {
                $result .= chr(($buffer >> ($bits - 8)) & 0xFF);
                $bits   -= 8;
            }
        }
        return $result;
    }

    private function hotp(string $secret, int $counter): string
    {
        $key   = $this->base32Decode($secret);
        $data  = pack('N*', 0) . pack('N*', $counter);
        $hash  = hash_hmac('sha1', $data, $key, true);
        $offset= ord($hash[19]) & 0xF;
        $code  = ((ord($hash[$offset]) & 0x7F) << 24)
               | ((ord($hash[$offset+1]) & 0xFF) << 16)
               | ((ord($hash[$offset+2]) & 0xFF) << 8)
               |  (ord($hash[$offset+3]) & 0xFF);
        return str_pad((string)($code % 1_000_000), 6, '0', STR_PAD_LEFT);
    }

    private function verifyCode(string $secret, string $code, int $window = 1): bool
    {
        $time = (int)(time() / 30);
        for ($i = -$window; $i <= $window; $i++) {
            if (hash_equals($this->hotp($secret, $time + $i), $code)) return true;
        }
        return false;
    }

    public function setup(): ResponseInterface
    {
        $db   = Database::connect();
        $user = Auth::user();

        if ($user['totp_enabled'] ?? 0) {
            return $this->response->setStatusCode(409)->setJSON(['message' => '2FA ya está activado']);
        }

        // Generate or reuse pending secret
        $secret = $user['totp_secret'] ?? $this->generateSecret();
        $db->table('users')->where('id', Auth::id())->update(['totp_secret' => $secret]);

        $label  = urlencode($user['username'] ?? $user['email']);
        $issuer = urlencode(env('EMAIL_FROM_NAME', 'PIAP'));
        $uri    = "otpauth://totp/{$issuer}:{$label}?secret={$secret}&issuer={$issuer}&algorithm=SHA1&digits=6&period=30";

        return $this->response->setJSON(['secret' => $secret, 'uri' => $uri]);
    }

    public function enable(): ResponseInterface
    {
        $db   = Database::connect();
        $data = $this->request->getJSON(true);
        $user = Auth::user();

        if (!($user['totp_secret'] ?? '')) {
            return $this->response->setStatusCode(422)->setJSON(['message' => 'Genera el secreto primero con GET /2fa/setup']);
        }
        if (!$this->verifyCode($user['totp_secret'], (string)($data['code'] ?? ''))) {
            return $this->response->setStatusCode(422)->setJSON(['message' => 'Código incorrecto']);
        }

        $db->table('users')->where('id', Auth::id())->update(['totp_enabled' => 1]);
        return $this->response->setJSON(['message' => '2FA activado correctamente']);
    }

    public function disable(): ResponseInterface
    {
        $db   = Database::connect();
        $data = $this->request->getJSON(true);
        $user = Auth::user();

        if (!($user['totp_enabled'] ?? 0)) {
            return $this->response->setStatusCode(422)->setJSON(['message' => '2FA no está activado']);
        }
        if (!$this->verifyCode($user['totp_secret'], (string)($data['code'] ?? ''))) {
            return $this->response->setStatusCode(422)->setJSON(['message' => 'Código incorrecto']);
        }

        $db->table('users')->where('id', Auth::id())->update(['totp_enabled' => 0, 'totp_secret' => null]);
        return $this->response->setJSON(['message' => '2FA desactivado']);
    }

    public function verify(): ResponseInterface
    {
        $data = $this->request->getJSON(true);
        $user = Auth::user();
        if (!($user['totp_enabled'] ?? 0)) {
            return $this->response->setJSON(['required' => false]);
        }
        $ok = $this->verifyCode($user['totp_secret'] ?? '', (string)($data['code'] ?? ''));
        return $this->response->setJSON(['ok' => $ok]);
    }
}
