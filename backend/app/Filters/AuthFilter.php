<?php

namespace App\Filters;

use App\Libraries\Auth;
use App\Libraries\JWTHandler;
use App\Models\UserModel;
use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;

class AuthFilter implements FilterInterface
{
    public function before(RequestInterface $request, $arguments = null)
    {
        // Preflight OPTIONS → dejar pasar; el filtro CORS lo resuelve
        if ($request->getMethod() === 'options') {
            return null;
        }

        $header = $request->getHeaderLine('Authorization');

        // SSE (EventSource) cannot send custom headers — accept token as query param fallback
        if ((! $header || ! str_starts_with($header, 'Bearer ')) && $request->getGet('token')) {
            $header = 'Bearer ' . $request->getGet('token');
        }

        if (! $header || ! str_starts_with($header, 'Bearer ')) {
            return service('response')
                ->setStatusCode(401)
                ->setJSON(['message' => 'Token de acceso requerido']);
        }

        $token   = substr($header, 7);
        $jwt     = new JWTHandler();
        $decoded = $jwt->decode($token);

        if (! $decoded || ($decoded->type ?? '') !== 'access') {
            return service('response')
                ->setStatusCode(401)
                ->setJSON(['message' => 'Token inválido o expirado']);
        }

        $userModel = new UserModel();
        $user      = $userModel->safeFind((int) $decoded->sub);

        if (! $user || ! $user['is_active']) {
            return service('response')
                ->setStatusCode(401)
                ->setJSON(['message' => 'Usuario no autorizado']);
        }

        // Guardamos el usuario de forma segura (sin propiedad dinámica)
        Auth::setUser($user);
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null)
    {
        // Sin lógica post-respuesta
    }
}
