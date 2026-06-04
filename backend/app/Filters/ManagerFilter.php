<?php

namespace App\Filters;

use App\Libraries\Auth;
use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Permite acceso a ADMIN y DIRECTOR.
 * Usado para rutas de gestión que el Director también puede operar.
 */
class ManagerFilter implements FilterInterface
{
    public function before(RequestInterface $request, $arguments = null)
    {
        if ($request->getMethod() === 'options') {
            return null;
        }

        $role = Auth::user()['role'] ?? '';
        if (!in_array($role, ['ADMIN', 'DIRECTOR'], true)) {
            return service('response')
                ->setStatusCode(403)
                ->setJSON(['message' => 'Acceso restringido a administradores y directores']);
        }
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null)
    {
        return null;
    }
}
