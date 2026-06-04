<?php

namespace Config;

use App\Filters\AdminFilter;
use App\Filters\AuthFilter;
use App\Filters\CorsFilter;
use App\Filters\ManagerFilter;
use CodeIgniter\Config\Filters as BaseFilters;
use CodeIgniter\Filters\CSRF;
use CodeIgniter\Filters\DebugToolbar;
use CodeIgniter\Filters\ForceHTTPS;
use CodeIgniter\Filters\Honeypot;
use CodeIgniter\Filters\InvalidChars;
use CodeIgniter\Filters\PageCache;
use CodeIgniter\Filters\PerformanceMetrics;
use CodeIgniter\Filters\SecureHeaders;

class Filters extends BaseFilters
{
    /** @var array<string, class-string|list<class-string>> */
    public array $aliases = [
        'csrf'          => CSRF::class,
        'toolbar'       => DebugToolbar::class,
        'honeypot'      => Honeypot::class,
        'invalidchars'  => InvalidChars::class,
        'secureheaders' => SecureHeaders::class,
        'cors'          => CorsFilter::class,
        'auth'          => AuthFilter::class,
        'admin'         => AdminFilter::class,
        'manager'       => ManagerFilter::class,
        'forcehttps'    => ForceHTTPS::class,
        'pagecache'     => PageCache::class,
        'performance'   => PerformanceMetrics::class,
    ];

    /** @var array{before: list<string>, after: list<string>} */
    public array $required = [
        'before' => [
            // 'forcehttps', // habilitar en producción
            'pagecache',
        ],
        'after' => [
            'pagecache',
            'performance',
            'toolbar',
        ],
    ];

    /**
     * cors global: resuelve preflight OPTIONS antes de que llegue al router.
     * auth SOLO en rutas protegidas (vía group filter en Routes.php).
     */
    public array $globals = [
        'before' => [
            'cors',
        ],
        'after' => [
            'cors',
        ],
    ];

    public array $methods = [];

    // Auth se aplica por grupos en Routes.php (no aquí, para evitar duplicados)
    public array $filters = [];
}
