<?php

use CodeIgniter\Router\RouteCollection;

/** @var RouteCollection $routes */

// ─── Preflight OPTIONS global (CORS) ─────────────────────────────────────────
// El navegador envía OPTIONS antes de cualquier PATCH/PUT/DELETE cross-origin.
// Respondemos 204 inmediatamente sin pasar por el filtro de autenticación.
$routes->options('(:any)', static function () {
    return service('response')->setStatusCode(204)->setBody('');
});

// Auth (público)
$routes->post('api/auth/register',        'Api\AuthController::register');
$routes->post('api/auth/login',           'Api\AuthController::login');
$routes->post('api/auth/token/refresh',   'Api\AuthController::refresh');
$routes->post('api/auth/forgot-password', 'Api\AuthController::forgotPassword');
$routes->post('api/auth/reset-password',  'Api\AuthController::resetPassword');

// Auth (protegidas)
$routes->group('api/auth', ['filter' => 'auth'], function ($routes) {
    $routes->post('logout',           'Api\AuthController::logout');
    $routes->get('profile',           'Api\AuthController::profile');
    $routes->patch('profile/update',  'Api\AuthController::updateProfile');
});

// Perfil extendido (certificaciones y logros)
$routes->group('api/profile', ['filter' => 'auth'], function ($routes) {
    $routes->get('certifications',            'Api\CertificationsController::index');
    $routes->post('certifications',           'Api\CertificationsController::create');
    $routes->patch('certifications/(:num)',   'Api\CertificationsController::update/$1');
    $routes->delete('certifications/(:num)',  'Api\CertificationsController::delete/$1');

    $routes->get('achievements',             'Api\AchievementsController::index');
    $routes->post('achievements',            'Api\AchievementsController::create');
    $routes->patch('achievements/(:num)',    'Api\AchievementsController::update/$1');
    $routes->delete('achievements/(:num)',   'Api\AchievementsController::delete/$1');
});

// API protegida
$routes->group('api', ['filter' => 'auth'], function ($routes) {

    // Dashboard personal
    $routes->get('dashboard', 'Api\DashboardController::index');

    // Proyectos
    $routes->get('projects',                     'Api\ProjectsController::index');
    $routes->get('projects/statistics',          'Api\ProjectsController::statistics');
    $routes->get('projects/my',                  'Api\ProjectsController::myProjects');
    $routes->post('projects',                    'Api\ProjectsController::create');
    $routes->get('projects/(:num)',              'Api\ProjectsController::show/$1');
    $routes->put('projects/(:num)',              'Api\ProjectsController::update/$1');
    $routes->patch('projects/(:num)',            'Api\ProjectsController::update/$1');
    $routes->delete('projects/(:num)',           'Api\ProjectsController::delete/$1');
    $routes->post('projects/(:num)/progress',              'Api\ProjectsController::updateProgress/$1');
    // AI
    $routes->post('projects/(:num)/ai-summary',            'Api\AIController::summary/$1');
    $routes->post('projects/(:num)/ai-risks',              'Api\AIController::detectRisks/$1');
    // Portfolio
    $routes->get('portfolio',                              'Api\PortfolioController::index');
    // Delivery prediction
    $routes->get('projects/(:num)/delivery-prediction',    'Api\SprintsController::deliveryPrediction/$1');
    // CSV import
    $routes->post('projects/(:num)/import/csv',            'Api\CSVImportController::import/$1');
    $routes->get('projects/(:num)/import/csv-template',    'Api\CSVImportController::template/$1');
    // Guest invites
    $routes->get('projects/(:num)/invites',                'Api\GuestController::listInvites/$1');
    $routes->post('projects/(:num)/invites',               'Api\GuestController::createInvite/$1');
    $routes->delete('invites/(:num)',                      'Api\GuestController::deleteInvite/$1');
    // Webhooks
    $routes->get('projects/(:num)/webhooks',               'Api\WebhookController::index/$1');
    $routes->post('projects/(:num)/webhooks',              'Api\WebhookController::create/$1');
    $routes->patch('webhooks/(:num)',                      'Api\WebhookController::update/$1');
    $routes->delete('webhooks/(:num)',                     'Api\WebhookController::delete/$1');
    $routes->post('webhooks/(:num)/test',                  'Api\WebhookController::test/$1');
    // Chat
    $routes->get('projects/(:num)/chat',                   'Api\ChatController::index/$1');
    $routes->post('projects/(:num)/chat',                  'Api\ChatController::create/$1');
    $routes->delete('chat/(:num)',                         'Api\ChatController::delete/$1');
    // Wiki
    $routes->get('projects/(:num)/wiki',                   'Api\WikiController::index/$1');
    $routes->post('projects/(:num)/wiki',                  'Api\WikiController::create/$1');
    $routes->get('wiki/(:num)',                            'Api\WikiController::show/$1');
    $routes->patch('wiki/(:num)',                          'Api\WikiController::update/$1');
    $routes->delete('wiki/(:num)',                         'Api\WikiController::delete/$1');
    // OKRs
    $routes->get('projects/(:num)/okrs',                   'Api\OKRsController::index/$1');
    $routes->post('projects/(:num)/okrs',                  'Api\OKRsController::create/$1');
    $routes->patch('okrs/(:num)',                          'Api\OKRsController::update/$1');
    $routes->delete('okrs/(:num)',                         'Api\OKRsController::delete/$1');
    $routes->post('okrs/(:num)/key-results',               'Api\OKRsController::createKR/$1');
    $routes->patch('key-results/(:num)',                   'Api\OKRsController::updateKR/$1');
    $routes->delete('key-results/(:num)',                  'Api\OKRsController::deleteKR/$1');

    // Categorías
    $routes->get('categories',           'Api\CategoriesController::index');
    $routes->post('categories',          'Api\CategoriesController::create');
    $routes->get('categories/(:num)',    'Api\CategoriesController::show/$1');
    $routes->put('categories/(:num)',    'Api\CategoriesController::update/$1');
    $routes->patch('categories/(:num)', 'Api\CategoriesController::update/$1');
    $routes->delete('categories/(:num)','Api\CategoriesController::delete/$1');

    // Sprints
    $routes->get('sprints',                       'Api\SprintsController::index');
    $routes->get('sprints/velocity',              'Api\SprintsController::velocity');
    $routes->post('sprints',                      'Api\SprintsController::create');
    $routes->get('sprints/(:num)',                'Api\SprintsController::show/$1');
    $routes->get('sprints/(:num)/burndown',       'Api\SprintsController::burndown/$1');
    $routes->get('sprints/(:num)/burnup',         'Api\SprintsController::burnup/$1');
    $routes->get('sprints/(:num)/capacity',       'Api\CapacityController::index/$1');
    $routes->post('sprints/(:num)/capacity',      'Api\CapacityController::upsert/$1');
    $routes->put('sprints/(:num)',                'Api\SprintsController::update/$1');
    $routes->patch('sprints/(:num)',              'Api\SprintsController::update/$1');
    $routes->delete('sprints/(:num)',             'Api\SprintsController::delete/$1');

    // Backlog
    $routes->get('backlog',           'Api\BacklogController::index');
    $routes->post('backlog',          'Api\BacklogController::create');
    $routes->get('backlog/(:num)',    'Api\BacklogController::show/$1');
    $routes->put('backlog/(:num)',    'Api\BacklogController::update/$1');
    $routes->patch('backlog/(:num)', 'Api\BacklogController::update/$1');
    $routes->delete('backlog/(:num)','Api\BacklogController::delete/$1');

    // Tasks
    $routes->get('tasks',                                 'Api\TasksController::index');
    $routes->get('tasks/my',                              'Api\TasksController::myTasks');
    $routes->post('tasks',                                'Api\TasksController::create');
    $routes->get('tasks/(:num)',                          'Api\TasksController::show/$1');
    $routes->put('tasks/(:num)',                          'Api\TasksController::update/$1');
    $routes->patch('tasks/(:num)',                        'Api\TasksController::update/$1');
    $routes->delete('tasks/(:num)',                       'Api\TasksController::delete/$1');

    // Task Comments
    $routes->get('tasks/(:num)/comments',                'Api\TaskCommentsController::index/$1');
    $routes->post('tasks/(:num)/comments',               'Api\TaskCommentsController::create/$1');
    $routes->put('task-comments/(:num)',                  'Api\TaskCommentsController::update/$1');
    $routes->patch('task-comments/(:num)',                'Api\TaskCommentsController::update/$1');
    $routes->delete('task-comments/(:num)',               'Api\TaskCommentsController::delete/$1');

    // Milestones
    $routes->get('milestones',                            'Api\MilestonesController::index');
    $routes->post('milestones',                           'Api\MilestonesController::create');
    $routes->get('milestones/(:num)',                     'Api\MilestonesController::show/$1');
    $routes->put('milestones/(:num)',                     'Api\MilestonesController::update/$1');
    $routes->patch('milestones/(:num)',                   'Api\MilestonesController::update/$1');
    $routes->delete('milestones/(:num)',                  'Api\MilestonesController::delete/$1');
    $routes->post('milestones/(:num)/complete',           'Api\MilestonesController::complete/$1');

    // Risks
    $routes->get('risks',           'Api\RisksController::index');
    $routes->post('risks',          'Api\RisksController::create');
    $routes->get('risks/(:num)',    'Api\RisksController::show/$1');
    $routes->put('risks/(:num)',    'Api\RisksController::update/$1');
    $routes->patch('risks/(:num)', 'Api\RisksController::update/$1');
    $routes->delete('risks/(:num)','Api\RisksController::delete/$1');

    // Incidents
    $routes->get('incidents',           'Api\IncidentsController::index');
    $routes->post('incidents',          'Api\IncidentsController::create');
    $routes->get('incidents/(:num)',    'Api\IncidentsController::show/$1');
    $routes->put('incidents/(:num)',    'Api\IncidentsController::update/$1');
    $routes->patch('incidents/(:num)', 'Api\IncidentsController::update/$1');
    $routes->delete('incidents/(:num)','Api\IncidentsController::delete/$1');

    // Members
    $routes->get('members',           'Api\MembersController::index');
    $routes->post('members',          'Api\MembersController::create');
    $routes->put('members/(:num)',    'Api\MembersController::update/$1');
    $routes->patch('members/(:num)', 'Api\MembersController::update/$1');
    $routes->delete('members/(:num)','Api\MembersController::delete/$1');

    // Documents
    $routes->get('documents',         'Api\DocumentsController::index');
    $routes->post('documents',        'Api\DocumentsController::upload');
    $routes->delete('documents/(:num)','Api\DocumentsController::delete/$1');

    // Users (lectura disponible para todos los autenticados)
    $routes->get('users',            'Api\UsersController::index');
    $routes->get('users/(:num)',     'Api\UsersController::show/$1');

    // Notificaciones
    $routes->get('notifications',              'Api\NotificationsController::index');
    $routes->get('notifications/stream',       'Api\NotificationsController::stream');
    $routes->get('notifications/user',         'Api\NotificationsController::userNotifications');
    $routes->post('notifications/(:num)/read', 'Api\NotificationsController::markRead/$1');
    $routes->post('notifications/read-all',    'Api\NotificationsController::markAllRead');
    $routes->delete('notifications/(:num)',    'Api\NotificationsController::delete/$1');

    // Reportes
    $routes->get('reports/overview',        'Api\ReportsController::overview');
    $routes->get('reports/range',           'Api\ReportsController::range');
    $routes->get('reports/project/(:num)',  'Api\ReportsController::project/$1');
    $routes->get('reports/time',            'Api\ReportsController::time');

    // Company Settings
    $routes->get('company-settings',    'Api\CompanySettingsController::show');
    $routes->put('company-settings',    'Api\CompanySettingsController::update');
    $routes->patch('company-settings',  'Api\CompanySettingsController::update');

    // Task Checklists
    $routes->get('tasks/(:num)/checklists',    'Api\ChecklistsController::index/$1');
    $routes->post('tasks/(:num)/checklists',   'Api\ChecklistsController::create/$1');
    $routes->patch('checklists/(:num)',         'Api\ChecklistsController::update/$1');
    $routes->delete('checklists/(:num)',        'Api\ChecklistsController::delete/$1');

    // Task Time Logs
    $routes->get('tasks/(:num)/timelogs',      'Api\TimeLogsController::index/$1');
    $routes->post('tasks/(:num)/timelogs',     'Api\TimeLogsController::create/$1');
    $routes->patch('timelogs/(:num)',           'Api\TimeLogsController::update/$1');
    $routes->delete('timelogs/(:num)',          'Api\TimeLogsController::delete/$1');

    // Meeting Minutes (Actas de reunión)
    $routes->get('projects/(:num)/meetings',   'Api\MeetingMinutesController::index/$1');
    $routes->post('projects/(:num)/meetings',  'Api\MeetingMinutesController::create/$1');
    $routes->get('meetings/(:num)',            'Api\MeetingMinutesController::show/$1');
    $routes->patch('meetings/(:num)',          'Api\MeetingMinutesController::update/$1');
    $routes->put('meetings/(:num)',            'Api\MeetingMinutesController::update/$1');
    $routes->delete('meetings/(:num)',         'Api\MeetingMinutesController::delete/$1');

    // Task Dependencies
    $routes->get('tasks/(:num)/dependencies',        'Api\TaskDependenciesController::index/$1');
    $routes->post('tasks/(:num)/dependencies',       'Api\TaskDependenciesController::create/$1');
    $routes->delete('dependencies/(:num)',            'Api\TaskDependenciesController::delete/$1');
    $routes->get('projects/(:num)/dependencies',     'Api\TaskDependenciesController::byProject/$1');

    // Subtasks
    $routes->get('tasks/(:num)/subtasks',        'Api\SubtasksController::index/$1');
    $routes->post('tasks/(:num)/subtasks',       'Api\SubtasksController::create/$1');
    $routes->patch('subtasks/(:num)',            'Api\SubtasksController::update/$1');
    $routes->delete('subtasks/(:num)',           'Api\SubtasksController::delete/$1');

    // Task Attachments
    $routes->get('tasks/(:num)/attachments',         'Api\TaskAttachmentsController::index/$1');
    $routes->post('tasks/(:num)/attachments',        'Api\TaskAttachmentsController::upload/$1');
    $routes->delete('attachments/(:num)',            'Api\TaskAttachmentsController::delete/$1');

    // Comment Reactions
    $routes->get('comments/(:num)/reactions',        'Api\CommentReactionsController::index/$1');
    $routes->post('comments/(:num)/reactions',       'Api\CommentReactionsController::toggle/$1');

    // Audit Log (admin only)
    $routes->get('audit',                            'Api\AuditController::index');

    // Project Templates
    $routes->get('templates',                        'Api\ProjectTemplatesController::index');
    $routes->post('templates',                       'Api\ProjectTemplatesController::create');
    $routes->get('templates/(:num)',                 'Api\ProjectTemplatesController::show/$1');
    $routes->patch('templates/(:num)',               'Api\ProjectTemplatesController::update/$1');
    $routes->delete('templates/(:num)',              'Api\ProjectTemplatesController::delete/$1');
    $routes->post('templates/(:num)/save-from-project', 'Api\ProjectTemplatesController::saveFromProject/$1');
    $routes->post('templates/(:num)/create-project',    'Api\ProjectTemplatesController::createProject/$1');

    // Activity Log
    $routes->get('projects/(:num)/activity',   'Api\ActivityController::index/$1');
    $routes->put('activity/(:num)',            'Api\ActivityController::update/$1');
    $routes->delete('activity/(:num)',         'Api\ActivityController::delete/$1');

    // Favorites
    $routes->get('favorites',                  'Api\FavoritesController::index');
    $routes->post('favorites/(:num)',           'Api\FavoritesController::toggle/$1');

    // Workload
    $routes->get('projects/(:num)/workload',   'Api\WorkloadController::index/$1');

    // Global Search
    $routes->get('search',                     'Api\SearchController::index');

    // Calendar (tasks + milestones by month for current user)
    $routes->get('calendar',                   'Api\CalendarController::index');

    // Contratos de proyecto
    $routes->get('projects/(:num)/contracts',    'Api\ContractsController::index/$1');
    $routes->post('projects/(:num)/contracts',   'Api\ContractsController::create/$1');
    $routes->patch('contracts/(:num)',            'Api\ContractsController::update/$1');
    $routes->delete('contracts/(:num)',           'Api\ContractsController::delete/$1');

    // Documentación técnica de proyecto
    $routes->get('projects/(:num)/technicaldocs',       'Api\TechnicalDocsController::index/$1');
    $routes->post('projects/(:num)/technicaldocs',      'Api\TechnicalDocsController::create/$1');
    $routes->patch('technicaldocs/(:num)',              'Api\TechnicalDocsController::update/$1');
    $routes->delete('technicaldocs/(:num)',             'Api\TechnicalDocsController::delete/$1');
    $routes->post('technicaldocs/(:num)/approve',       'Api\TechnicalDocsController::approve/$1');
    $routes->post('technicaldocs/(:num)/request-review','Api\TechnicalDocsController::requestReview/$1');
    $routes->patch('technicaldocs/(:num)/sort',         'Api\TechnicalDocsController::updateSort/$1');
    // Versions & comments (authenticated)
    $routes->get('technicaldocs/(:num)/versions',      'Api\TechDocVersionsController::index/$1');
    $routes->get('technicaldocs/(:num)/comments',      'Api\TechDocCommentsController::index/$1');
    $routes->post('technicaldocs/(:num)/comments',     'Api\TechDocCommentsController::create/$1');
    $routes->delete('tech-doc-comments/(:num)',         'Api\TechDocCommentsController::delete/$1');

    // Épicas
    $routes->get('epics',             'Api\EpicsController::index');
    $routes->post('epics',            'Api\EpicsController::create');
    $routes->put('epics/(:num)',       'Api\EpicsController::update/$1');
    $routes->patch('epics/(:num)',     'Api\EpicsController::update/$1');
    $routes->delete('epics/(:num)',    'Api\EpicsController::delete/$1');

    // Impedimentos
    $routes->get('impediments',           'Api\ImpedimentsController::index');
    $routes->post('impediments',          'Api\ImpedimentsController::create');
    $routes->put('impediments/(:num)',     'Api\ImpedimentsController::update/$1');
    $routes->patch('impediments/(:num)',   'Api\ImpedimentsController::update/$1');
    $routes->delete('impediments/(:num)', 'Api\ImpedimentsController::delete/$1');

    // Definition of Done
    $routes->get('projects/(:num)/dod',   'Api\DefinitionOfDoneController::show/$1');
    $routes->put('projects/(:num)/dod',   'Api\DefinitionOfDoneController::update/$1');
    $routes->patch('projects/(:num)/dod', 'Api\DefinitionOfDoneController::update/$1');

    // Sprint Review
    $routes->get('sprints/(:num)/review', 'Api\SprintReviewController::show/$1');
    $routes->put('sprints/(:num)/review', 'Api\SprintReviewController::update/$1');

    // Sprint Retrospectiva
    $routes->get('sprints/(:num)/retro',  'Api\SprintRetrospectiveController::show/$1');
    $routes->put('sprints/(:num)/retro',  'Api\SprintRetrospectiveController::update/$1');

    // ── Portfolio ──────────────────────────────────────────────────────────
    $routes->get('portfolio', 'Api\PortfolioController::index');

    // ── AI ─────────────────────────────────────────────────────────────────
    $routes->post('projects/(:num)/ai-summary',  'Api\AIController::summary/$1');
    $routes->post('projects/(:num)/ai-risks',    'Api\AIController::detectRisks/$1');

    // ── Analytics ──────────────────────────────────────────────────────────
    $routes->get('projects/(:num)/cfd',              'Api\AnalyticsController::cfd/$1');
    $routes->get('projects/(:num)/lead-time',        'Api\AnalyticsController::leadTime/$1');
    $routes->get('projects/(:num)/risk-matrix',      'Api\AnalyticsController::riskMatrix/$1');
    $routes->get('projects/(:num)/velocity-trend',   'Api\AnalyticsController::velocityTrend/$1');
    $routes->get('projects/(:num)/profitability',    'Api\AnalyticsController::profitability/$1');

    // ── Invoice ────────────────────────────────────────────────────────────
    $routes->get('projects/(:num)/invoice', 'Api\InvoiceController::show/$1');

    // ── Labels ─────────────────────────────────────────────────────────────
    $routes->get('projects/(:num)/labels',            'Api\LabelsController::index/$1');
    $routes->post('projects/(:num)/labels',           'Api\LabelsController::create/$1');
    $routes->patch('labels/(:num)',                   'Api\LabelsController::update/$1');
    $routes->delete('labels/(:num)',                  'Api\LabelsController::delete/$1');
    $routes->get('tasks/(:num)/labels',               'Api\LabelsController::taskLabels/$1');
    $routes->post('tasks/(:num)/labels',              'Api\LabelsController::attach/$1');
    $routes->delete('tasks/(:num)/labels/(:num)',     'Api\LabelsController::detach/$1/$2');

    // ── Task Templates ─────────────────────────────────────────────────────
    $routes->get('projects/(:num)/task-templates',           'Api\TaskTemplatesController::index/$1');
    $routes->post('projects/(:num)/task-templates',          'Api\TaskTemplatesController::create/$1');
    $routes->patch('task-templates/(:num)',                   'Api\TaskTemplatesController::update/$1');
    $routes->delete('task-templates/(:num)',                  'Api\TaskTemplatesController::delete/$1');
    $routes->post('task-templates/(:num)/apply',             'Api\TaskTemplatesController::apply/$1');

    // ── Planning Poker ─────────────────────────────────────────────────────
    $routes->get('projects/(:num)/poker',       'Api\PlanningPokerController::index/$1');
    $routes->post('projects/(:num)/poker',      'Api\PlanningPokerController::create/$1');
    $routes->get('poker/(:num)',                'Api\PlanningPokerController::show/$1');
    $routes->post('poker/(:num)/vote',          'Api\PlanningPokerController::vote/$1');
    $routes->post('poker/(:num)/reveal',        'Api\PlanningPokerController::reveal/$1');
    $routes->post('poker/(:num)/close',         'Api\PlanningPokerController::close/$1');

    // ── 2FA ────────────────────────────────────────────────────────────────
    $routes->get('2fa/setup',    'Api\TwoFactorController::setup');
    $routes->post('2fa/enable',  'Api\TwoFactorController::enable');
    $routes->post('2fa/disable', 'Api\TwoFactorController::disable');
    $routes->post('2fa/verify',  'Api\TwoFactorController::verify');

    // ── Session history ────────────────────────────────────────────────────
    $routes->get('sessions',            'Api\SessionsController::index');
    $routes->delete('sessions/(:num)',  'Api\SessionsController::revoke/$1');
    $routes->delete('sessions',         'Api\SessionsController::revokeAll');

    // ── Custom Roles ───────────────────────────────────────────────────────
    $routes->get('roles',            'Api\CustomRolesController::index');
    $routes->post('roles',           'Api\CustomRolesController::create');
    $routes->patch('roles/(:num)',   'Api\CustomRolesController::update/$1');
    $routes->delete('roles/(:num)', 'Api\CustomRolesController::delete/$1');
    $routes->get('roles/permissions','Api\CustomRolesController::getPermissionKeys');

    // ── OKRs ───────────────────────────────────────────────────────────────
    $routes->get('okrs',                         'Api\OKRsController::index');
    $routes->post('okrs',                        'Api\OKRsController::create');
    $routes->patch('okrs/(:num)',                'Api\OKRsController::update/$1');
    $routes->delete('okrs/(:num)',               'Api\OKRsController::delete/$1');
    $routes->get('okrs/(:num)/key-results',      'Api\OKRsController::keyResults/$1');
    $routes->post('okrs/(:num)/key-results',     'Api\OKRsController::createKR/$1');
    $routes->patch('key-results/(:num)',         'Api\OKRsController::updateKR/$1');
    $routes->delete('key-results/(:num)',        'Api\OKRsController::deleteKR/$1');

    // ── Capacity planning ──────────────────────────────────────────────────
    $routes->get('sprints/(:num)/capacity',    'Api\CapacityController::index/$1');
    $routes->put('sprints/(:num)/capacity',    'Api\CapacityController::upsert/$1');

    // ── Chat ───────────────────────────────────────────────────────────────
    $routes->get('projects/(:num)/chat',        'Api\ChatController::index/$1');
    $routes->post('projects/(:num)/chat',       'Api\ChatController::create/$1');
    $routes->delete('chat/(:num)',              'Api\ChatController::delete/$1');

    // ── Wiki ───────────────────────────────────────────────────────────────
    $routes->get('projects/(:num)/wiki',        'Api\WikiController::index/$1');
    $routes->post('projects/(:num)/wiki',       'Api\WikiController::create/$1');
    $routes->get('wiki/(:num)',                 'Api\WikiController::show/$1');
    $routes->patch('wiki/(:num)',               'Api\WikiController::update/$1');
    $routes->delete('wiki/(:num)',              'Api\WikiController::delete/$1');

    // ── Webhooks ───────────────────────────────────────────────────────────
    $routes->get('webhooks',            'Api\WebhooksController::index');
    $routes->post('webhooks',           'Api\WebhooksController::create');
    $routes->patch('webhooks/(:num)',   'Api\WebhooksController::update/$1');
    $routes->delete('webhooks/(:num)', 'Api\WebhooksController::delete/$1');
    $routes->post('webhooks/(:num)/test','Api\WebhooksController::test/$1');

    // ── CSV / Jira import ──────────────────────────────────────────────────
    $routes->post('projects/(:num)/import/csv',  'Api\ImportController::csv/$1');
    $routes->post('projects/(:num)/import/jira', 'Api\ImportController::jira/$1');

    // ── Excel export ───────────────────────────────────────────────────────
    $routes->get('projects/(:num)/export/excel', 'Api\ExportController::excel/$1');

    // ── Automations ────────────────────────────────────────────────────────
    $routes->get('automations/meta',                          'Api\AutomationsController::getMetadata');
    $routes->get('projects/(:num)/automations',               'Api\AutomationsController::index/$1');
    $routes->post('projects/(:num)/automations',              'Api\AutomationsController::create/$1');
    $routes->patch('automations/(:num)',                      'Api\AutomationsController::update/$1');
    $routes->delete('automations/(:num)',                     'Api\AutomationsController::delete/$1');
    $routes->post('automations/(:num)/toggle',                'Api\AutomationsController::toggle/$1');
    $routes->get('automations/(:num)/logs',                   'Api\AutomationsController::logs/$1');

    // ── Custom Fields ──────────────────────────────────────────────────────
    $routes->get('projects/(:num)/custom-fields',             'Api\CustomFieldsController::index/$1');
    $routes->post('projects/(:num)/custom-fields',            'Api\CustomFieldsController::create/$1');
    $routes->patch('custom-fields/(:num)',                    'Api\CustomFieldsController::update/$1');
    $routes->delete('custom-fields/(:num)',                   'Api\CustomFieldsController::delete/$1');
    $routes->get('tasks/(:num)/custom-values',                'Api\CustomFieldsController::getTaskValues/$1');
    $routes->put('tasks/(:num)/custom-values',                'Api\CustomFieldsController::setTaskValues/$1');

    // ── Custom Statuses ────────────────────────────────────────────────────
    $routes->get('projects/(:num)/statuses',                  'Api\ProjectStatusesController::index/$1');
    $routes->post('projects/(:num)/statuses',                 'Api\ProjectStatusesController::create/$1');
    $routes->patch('project-statuses/(:num)',                 'Api\ProjectStatusesController::update/$1');
    $routes->delete('project-statuses/(:num)',                'Api\ProjectStatusesController::delete/$1');

    // ── Saved Filters ──────────────────────────────────────────────────────
    $routes->get('saved-filters',                             'Api\SavedFiltersController::index');
    $routes->post('saved-filters',                            'Api\SavedFiltersController::create');
    $routes->delete('saved-filters/(:num)',                   'Api\SavedFiltersController::delete/$1');

    // ── Releases ───────────────────────────────────────────────────────────
    $routes->get('projects/(:num)/releases',                  'Api\ReleasesController::index/$1');
    $routes->post('projects/(:num)/releases',                 'Api\ReleasesController::create/$1');
    $routes->patch('releases/(:num)',                         'Api\ReleasesController::update/$1');
    $routes->delete('releases/(:num)',                        'Api\ReleasesController::delete/$1');
    $routes->get('releases/(:num)/tasks',                     'Api\ReleasesController::tasks/$1');
    $routes->post('releases/(:num)/tasks',                    'Api\ReleasesController::addTasks/$1');
    $routes->post('releases/(:num)/generate-changelog',       'Api\ReleasesController::generateChangelog/$1');

    // ── Standup ────────────────────────────────────────────────────────────
    $routes->get('projects/(:num)/standup',                   'Api\StandupController::index/$1');
    $routes->post('projects/(:num)/standup/questions',        'Api\StandupController::createQuestion/$1');
    $routes->delete('standup/questions/(:num)',               'Api\StandupController::deleteQuestion/$1');
    $routes->post('standup/(:num)/answer',                    'Api\StandupController::answer/$1');
    $routes->get('projects/(:num)/standup/history',           'Api\StandupController::history/$1');

    // ── Weekly Reports ─────────────────────────────────────────────────────
    $routes->get('projects/(:num)/weekly-reports',            'Api\WeeklyReportsController::index/$1');
    $routes->post('projects/(:num)/weekly-reports',           'Api\WeeklyReportsController::create/$1');
    $routes->patch('weekly-reports/(:num)',                   'Api\WeeklyReportsController::update/$1');
    $routes->delete('weekly-reports/(:num)',                  'Api\WeeklyReportsController::delete/$1');

    // ── SLA ────────────────────────────────────────────────────────────────
    $routes->get('projects/(:num)/sla/policies',              'Api\SLAController::policies/$1');
    $routes->post('projects/(:num)/sla/policies',             'Api\SLAController::createPolicy/$1');
    $routes->patch('sla/policies/(:num)',                     'Api\SLAController::updatePolicy/$1');
    $routes->delete('sla/policies/(:num)',                    'Api\SLAController::deletePolicy/$1');
    $routes->get('projects/(:num)/sla/dashboard',             'Api\SLAController::dashboard/$1');

    // ── Announcements ──────────────────────────────────────────────────────
    $routes->get('projects/(:num)/announcements',             'Api\AnnouncementsController::index/$1');
    $routes->post('projects/(:num)/announcements',            'Api\AnnouncementsController::create/$1');
    $routes->patch('announcements/(:num)',                    'Api\AnnouncementsController::update/$1');
    $routes->delete('announcements/(:num)',                   'Api\AnnouncementsController::delete/$1');
    $routes->post('announcements/(:num)/read',                'Api\AnnouncementsController::markRead/$1');

    // ── Weekly Reports / Dashboard Widgets ─────────────────────────────────
    $routes->get('dashboard-widgets',                         'Api\DashboardWidgetsController::index');
    $routes->post('dashboard-widgets',                        'Api\DashboardWidgetsController::save');

    // ── Git Integration ────────────────────────────────────────────────────
    $routes->get('projects/(:num)/git',                       'Api\GitIntegrationController::index/$1');
    $routes->post('projects/(:num)/git',                      'Api\GitIntegrationController::create/$1');
    $routes->delete('git/(:num)',                             'Api\GitIntegrationController::delete/$1');
    $routes->get('projects/(:num)/git/commits',               'Api\GitIntegrationController::commits/$1');

    // ── IP Allowlist ───────────────────────────────────────────────────────
    $routes->get('ip-allowlist',                              'Api\IPAllowlistController::index');
    $routes->post('ip-allowlist',                             'Api\IPAllowlistController::create');
    $routes->patch('ip-allowlist/(:num)',                     'Api\IPAllowlistController::update/$1');
    $routes->delete('ip-allowlist/(:num)',                    'Api\IPAllowlistController::delete/$1');

    // ── Doc Signatures ─────────────────────────────────────────────────────
    $routes->get('technicaldocs/(:num)/signatures',           'Api\DocSignaturesController::index/$1');
    $routes->post('technicaldocs/(:num)/sign',                'Api\DocSignaturesController::sign/$1');
    $routes->get('technicaldocs/(:num)/verify',               'Api\DocSignaturesController::verify/$1');

    // ── File Annotations ────────────────────────────────────────────────────
    $routes->get('documents/(:num)/annotations',    'Api\FileAnnotationsController::index/$1');
    $routes->post('documents/(:num)/annotations',   'Api\FileAnnotationsController::create/$1');
    $routes->patch('annotations/(:num)',            'Api\FileAnnotationsController::update/$1');
    $routes->patch('annotations/(:num)/resolve',    'Api\FileAnnotationsController::resolve/$1');
    $routes->delete('annotations/(:num)',           'Api\FileAnnotationsController::delete/$1');

    // ── Description History ─────────────────────────────────────────────────────
    $routes->get('tasks/(:num)/description-history',                     'Api\DescriptionHistoryController::index/$1');
    $routes->post('tasks/(:num)/description-history/(:num)/restore',     'Api\DescriptionHistoryController::restore/$1/$2');

    // ── Tech doc extras ────────────────────────────────────────────────────
    $routes->get('technicaldocs/(:num)/versions',    'Api\TechDocVersionsController::index/$1');
    $routes->get('technicaldocs/(:num)/comments',    'Api\TechDocCommentsController::index/$1');
    $routes->post('technicaldocs/(:num)/comments',   'Api\TechDocCommentsController::create/$1');
    $routes->delete('tech-doc-comments/(:num)',      'Api\TechDocCommentsController::delete/$1');
    $routes->post('technicaldocs/(:num)/approve',         'Api\TechnicalDocsController::approve/$1');
    $routes->post('technicaldocs/(:num)/request-review',  'Api\TechnicalDocsController::requestReview/$1');
    $routes->patch('technicaldocs/(:num)/sort',           'Api\TechnicalDocsController::sort/$1');

    // ── Attendance (usuario) ──────────────────────────────────────────────
    $routes->get('attendance/locations',   'Api\AttendanceController::indexLocations');
    $routes->get('attendance/status',      'Api\AttendanceController::status');
    $routes->post('attendance/check-in',   'Api\AttendanceController::checkIn');
    $routes->post('attendance/check-out',  'Api\AttendanceController::checkOut');
    $routes->get('attendance/my',          'Api\AttendanceController::myRecords');
});

// Git webhooks (public — verified by signature)
$routes->post('api/git-webhook/(:num)', 'Api\GitIntegrationController::webhook/$1');

// Guest public access (read-only via invite token)
$routes->get('api/guest/(:alphanum)', 'Api\GuestController::view/$1');

// Descargas públicas — capability URLs (nombre aleatorio = seguridad suficiente)
$routes->get('api/attachments/(:num)/download',         'Api\TaskAttachmentsController::download/$1');
$routes->get('api/technicaldocs/(:num)/download',       'Api\TechnicalDocsController::download/$1');
$routes->get('api/tech-doc-versions/(:num)/download',   'Api\TechDocVersionsController::download/$1');

// Rutas ADMIN (auth + admin filter)
$routes->group('api/admin', ['filter' => ['auth', 'admin']], function ($routes) {
    // User management
    $routes->post('users',                          'Api\UsersController::create');
    $routes->patch('users/(:num)',                  'Api\UsersController::update/$1');
    $routes->put('users/(:num)',                    'Api\UsersController::update/$1');
    $routes->delete('users/(:num)',                 'Api\UsersController::delete/$1');
    $routes->post('users/(:num)/activate',          'Api\UsersController::activate/$1');
    $routes->post('users/(:num)/reset-password',    'Api\UsersController::sendResetEmail/$1');
    $routes->get('users/(:num)/assignments',        'Api\UsersController::assignments/$1');
    $routes->delete('users/(:num)/permanent',       'Api\UsersController::destroy/$1');
    // Permissions panel
    $routes->get('teams',                           'Api\MembersController::allTeams');

    // ── Attendance (solo admin gestiona) ──────────────────────────────────
    // Ubicaciones
    $routes->post('attendance/locations',             'Api\AttendanceController::createLocation');
    $routes->patch('attendance/locations/(:num)',     'Api\AttendanceController::updateLocation/$1');
    $routes->delete('attendance/locations/(:num)',    'Api\AttendanceController::deleteLocation/$1');
    // Registros
    $routes->get('attendance/records',               'Api\AttendanceController::allRecords');
    $routes->post('attendance/records',              'Api\AttendanceController::createRecord');
    $routes->patch('attendance/records/(:num)',       'Api\AttendanceController::updateRecord/$1');
    $routes->delete('attendance/records/(:num)',      'Api\AttendanceController::deleteRecord/$1');
    // Dashboard
    $routes->get('attendance/today',                 'Api\AttendanceController::today');
    $routes->get('attendance/users-list',            'Api\AttendanceController::usersList');
});
