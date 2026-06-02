import api from './api';

export const projectsAPI = {
  // Proyectos
  getProjects:    (p)  => api.get('/projects', { params: p }),
  getProject:     (id) => api.get(`/projects/${id}`),
  createProject:  (d)  => api.post('/projects', d),
  updateProject:  (id, d) => api.patch(`/projects/${id}`, d),
  deleteProject:  (id) => api.delete(`/projects/${id}`),
  getStatistics:  ()   => api.get('/projects/statistics'),
  getMyProjects:  ()   => api.get('/projects/my'),
  updateProgress: (id, pct) => api.post(`/projects/${id}/progress`, { completion_percentage: pct }),

  // Categorías
  getCategories:    ()     => api.get('/categories'),
  createCategory:   (d)    => api.post('/categories', d),
  updateCategory:   (id, d)=> api.patch(`/categories/${id}`, d),
  deleteCategory:   (id)   => api.delete(`/categories/${id}`),

  // Sprints
  getSprints:        (projectId) => api.get('/sprints', { params: { project: projectId } }),
  getSprint:         (id)        => api.get(`/sprints/${id}`),
  createSprint:      (d)         => api.post('/sprints', d),
  updateSprint:      (id, d)     => api.patch(`/sprints/${id}`, d),
  deleteSprint:      (id)        => api.delete(`/sprints/${id}`),
  getSprintBurndown: (id)        => api.get(`/sprints/${id}/burndown`),
  getSprintVelocity: (projectId) => api.get('/sprints/velocity', { params: { project: projectId } }),

  // Backlog
  getBacklogItems:  (projectId) => api.get('/backlog', { params: { project: projectId } }),
  createBacklogItem:(d)         => api.post('/backlog', d),
  updateBacklogItem:(id, d)     => api.patch(`/backlog/${id}`, d),
  deleteBacklogItem:(id)        => api.delete(`/backlog/${id}`),

  // Tareas (Kanban)
  getTasks:    (params) => api.get('/tasks', { params }),
  getMyTasks:  (params) => api.get('/tasks/my', { params }),
  createTask:  (d)      => api.post('/tasks', d),
  updateTask:  (id, d)  => api.patch(`/tasks/${id}`, d),
  deleteTask:  (id)     => api.delete(`/tasks/${id}`),

  // Comentarios de tarea
  getTaskComments:   (taskId) => api.get(`/tasks/${taskId}/comments`),
  createTaskComment: (taskId, d) => api.post(`/tasks/${taskId}/comments`, d),
  updateTaskComment: (commentId, d) => api.patch(`/task-comments/${commentId}`, d),
  deleteTaskComment: (commentId) => api.delete(`/task-comments/${commentId}`),

  // Hitos (Milestones)
  getMilestones:    (projectId) => api.get('/milestones', { params: { project: projectId } }),
  createMilestone:  (d)         => api.post('/milestones', d),
  updateMilestone:  (id, d)     => api.patch(`/milestones/${id}`, d),
  deleteMilestone:  (id)        => api.delete(`/milestones/${id}`),
  completeMilestone:(id)        => api.post(`/milestones/${id}/complete`),

  // Riesgos
  getRisks:    (projectId) => api.get('/risks', { params: { project: projectId } }),
  createRisk:  (d)         => api.post('/risks', d),
  updateRisk:  (id, d)     => api.patch(`/risks/${id}`, d),
  deleteRisk:  (id)        => api.delete(`/risks/${id}`),

  // Incidencias
  getIncidents:    (projectId) => api.get('/incidents', { params: { project: projectId } }),
  createIncident:  (d)         => api.post('/incidents', d),
  updateIncident:  (id, d)     => api.patch(`/incidents/${id}`, d),
  deleteIncident:  (id)        => api.delete(`/incidents/${id}`),

  // Miembros
  getMembers:   (projectId) => api.get('/members', { params: { project: projectId } }),
  addMember:    (d)         => api.post('/members', d),
  updateMember: (id, d)     => api.patch(`/members/${id}`, d),
  removeMember: (id)        => api.delete(`/members/${id}`),

  // Documentos
  getDocuments:   (projectId) => api.get('/documents', { params: { project: projectId } }),
  uploadDocument: (formData)  => api.post('/documents', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  deleteDocument: (id)        => api.delete(`/documents/${id}`),

  // Usuarios
  getUsers:          (p) => api.get('/users', { params: p }),
  getUser:           (id) => api.get(`/users/${id}`),

  // Admin - User Management
  adminCreateUser:   (d)     => api.post('/admin/users', d),
  adminUpdateUser:   (id, d) => api.patch(`/admin/users/${id}`, d),
  adminDeleteUser:   (id)    => api.delete(`/admin/users/${id}`),
  adminActivateUser:        (id)      => api.post(`/admin/users/${id}/activate`),
  adminResetUserPassword:   (id)      => api.post(`/admin/users/${id}/reset-password`),
  adminGetUserAssignments:  (id)      => api.get(`/admin/users/${id}/assignments`),
  adminHardDeleteUser:      (id, data) => api.delete(`/admin/users/${id}/permanent`, { data }),
  adminGetTeams:     ()      => api.get('/admin/teams'),

  // Task Checklists
  getChecklists:    (taskId)      => api.get(`/tasks/${taskId}/checklists`),
  createChecklist:  (taskId, d)   => api.post(`/tasks/${taskId}/checklists`, d),
  updateChecklist:  (id, d)       => api.patch(`/checklists/${id}`, d),
  deleteChecklist:  (id)          => api.delete(`/checklists/${id}`),

  // Time Logs
  getTimeLogs:    (taskId)      => api.get(`/tasks/${taskId}/timelogs`),
  createTimeLog:  (taskId, d)   => api.post(`/tasks/${taskId}/timelogs`, d),
  updateTimeLog:  (id, d)       => api.patch(`/timelogs/${id}`, d),
  deleteTimeLog:  (id)          => api.delete(`/timelogs/${id}`),

  // Task dependencies
  getTaskDependencies:        (taskId)      => api.get(`/tasks/${taskId}/dependencies`),
  getProjectDependencies:     (projectId)   => api.get(`/projects/${projectId}/dependencies`),
  createTaskDependency:       (taskId, d)   => api.post(`/tasks/${taskId}/dependencies`, d),
  deleteTaskDependency:       (id)          => api.delete(`/dependencies/${id}`),

  // Activity
  getActivity:    (projectId)   => api.get(`/projects/${projectId}/activity`),
  updateActivity: (id, data)    => api.put(`/activity/${id}`, data),
  deleteActivity: (id)          => api.delete(`/activity/${id}`),

  // Favorites
  getFavorites:   ()            => api.get('/favorites'),
  toggleFavorite: (projectId)   => api.post(`/favorites/${projectId}`),

  // Workload
  getWorkload:    (projectId)   => api.get(`/projects/${projectId}/workload`),

  // Search
  search:         (q)           => api.get('/search', { params: { q } }),

  // Certificaciones (perfil)
  getCertifications:    ()      => api.get('/profile/certifications'),
  createCertification:  (d)     => api.post('/profile/certifications', d),
  updateCertification:  (id, d) => api.patch(`/profile/certifications/${id}`, d),
  deleteCertification:  (id)    => api.delete(`/profile/certifications/${id}`),

  // Logros (perfil)
  getAchievements:    ()      => api.get('/profile/achievements'),
  createAchievement:  (d)     => api.post('/profile/achievements', d),
  updateAchievement:  (id, d) => api.patch(`/profile/achievements/${id}`, d),
  deleteAchievement:  (id)    => api.delete(`/profile/achievements/${id}`),

  // Contratos de proyecto
  getContracts:    (projectId)      => api.get(`/projects/${projectId}/contracts`),
  createContract:  (projectId, d)   => api.post(`/projects/${projectId}/contracts`, d),
  updateContract:  (id, d)          => api.patch(`/contracts/${id}`, d),
  deleteContract:  (id)             => api.delete(`/contracts/${id}`),

  // Documentación técnica de proyecto
  getTechnicalDocs:           (projectId)    => api.get(`/projects/${projectId}/technicaldocs`),
  createTechnicalDoc:         (projectId, d) => api.post(`/projects/${projectId}/technicaldocs`, d),
  uploadTechnicalDoc:         (projectId, fd)=> api.post(`/projects/${projectId}/technicaldocs`, fd),
  updateTechnicalDoc:         (id, d)        => api.patch(`/technicaldocs/${id}`, d),
  deleteTechnicalDoc:         (id)           => api.delete(`/technicaldocs/${id}`),
  approveTechnicalDoc:        (id, d)        => api.post(`/technicaldocs/${id}/approve`, d),
  requestTechnicalDocReview:  (id)           => api.post(`/technicaldocs/${id}/request-review`),
  sortTechnicalDoc:           (id, order)    => api.patch(`/technicaldocs/${id}/sort`, { sort_order: order }),
  getTechnicalDocDownloadUrl: (id)           => `${api.defaults.baseURL}/technicaldocs/${id}/download`,
  getTechDocVersions:         (docId)        => api.get(`/technicaldocs/${docId}/versions`),
  getTechDocVersionDownloadUrl:(id)          => `${api.defaults.baseURL}/tech-doc-versions/${id}/download`,
  getTechDocComments:         (docId)        => api.get(`/technicaldocs/${docId}/comments`),
  createTechDocComment:       (docId, body)  => api.post(`/technicaldocs/${docId}/comments`, { body }),
  deleteTechDocComment:       (id)           => api.delete(`/tech-doc-comments/${id}`),

  // AI
  getAISummary:     (projectId)    => api.post(`/projects/${projectId}/ai-summary`),
  getAIRisks:       (projectId)    => api.post(`/projects/${projectId}/ai-risks`),

  // Portfolio
  getPortfolio:     ()             => api.get('/portfolio'),

  // Delivery prediction
  getDeliveryPrediction: (projectId) => api.get(`/projects/${projectId}/delivery-prediction`),

  // Burnup
  getSprintBurnup:  (sprintId)     => api.get(`/sprints/${sprintId}/burnup`),

  // Capacity planning
  getCapacity:      (sprintId)     => api.get(`/sprints/${sprintId}/capacity`),
  upsertCapacity:   (sprintId, d)  => api.post(`/sprints/${sprintId}/capacity`, d),

  // CSV import
  importCSV:        (projectId, fd)=> api.post(`/projects/${projectId}/import/csv`, fd),
  getCSVTemplate:   ()             => `${api.defaults.baseURL}/projects/0/import/csv-template`,

  // Webhooks
  getWebhooks:      (projectId)    => api.get(`/projects/${projectId}/webhooks`),
  createWebhook:    (projectId, d) => api.post(`/projects/${projectId}/webhooks`, d),
  updateWebhook:    (id, d)        => api.patch(`/webhooks/${id}`, d),
  deleteWebhook:    (id)           => api.delete(`/webhooks/${id}`),
  testWebhook:      (id)           => api.post(`/webhooks/${id}/test`),

  // Chat
  getChat:          (projectId, after) => api.get(`/projects/${projectId}/chat`, { params: { after, limit: 50 } }),
  sendChat:         (projectId, body)  => api.post(`/projects/${projectId}/chat`, { body }),
  deleteChat:       (id)               => api.delete(`/chat/${id}`),

  // Wiki
  getWikiPages:     (projectId)    => api.get(`/projects/${projectId}/wiki`),
  getWikiPage:      (id)           => api.get(`/wiki/${id}`),
  createWikiPage:   (projectId, d) => api.post(`/projects/${projectId}/wiki`, d),
  updateWikiPage:   (id, d)        => api.patch(`/wiki/${id}`, d),
  deleteWikiPage:   (id)           => api.delete(`/wiki/${id}`),

  // OKRs
  getOKRs:          (projectId)    => api.get(`/projects/${projectId}/okrs`),
  createOKR:        (projectId, d) => api.post(`/projects/${projectId}/okrs`, d),
  updateOKR:        (id, d)        => api.patch(`/okrs/${id}`, d),
  deleteOKR:        (id)           => api.delete(`/okrs/${id}`),
  createKR:         (objId, d)     => api.post(`/okrs/${objId}/key-results`, d),
  updateKR:         (id, d)        => api.patch(`/key-results/${id}`, d),
  deleteKR:         (id)           => api.delete(`/key-results/${id}`),

  // Guest invites
  getInvites:       (projectId)    => api.get(`/projects/${projectId}/invites`),
  createInvite:     (projectId, d) => api.post(`/projects/${projectId}/invites`, d),
  deleteInvite:     (id)           => api.delete(`/invites/${id}`),
  getGuestView:     (token)        => api.get(`/guest/${token}`),

  // Configuración
  getCompanySettings:    ()  => api.get('/company-settings'),
  updateCompanySettings: (d) => api.patch('/company-settings', d),

  // Calendario
  getCalendar: (year, month) => api.get('/calendar', { params: { year, month } }),

  // Dashboard personal
  getDashboard: () => api.get('/dashboard'),

  // Notificaciones
  getNotifications:          ()     => api.get('/notifications'),
  getUserNotifications:      (page) => api.get('/notifications/user', { params: { page: page ?? 1 } }),
  markNotificationRead:      (id)   => api.post(`/notifications/${id}/read`),
  markAllNotificationsRead:  ()     => api.post('/notifications/read-all'),
  deleteNotification:        (id)   => api.delete(`/notifications/${id}`),

  // Reportes
  getReportOverview:   ()       => api.get('/reports/overview'),
  getReportRange:      (params) => api.get('/reports/range', { params }),
  getReportProject:    (id)     => api.get(`/reports/project/${id}`),

  // Meeting Minutes (Actas de reunión)
  getMeetings:    (projectId) => api.get(`/projects/${projectId}/meetings`),
  createMeeting:  (projectId, d) => api.post(`/projects/${projectId}/meetings`, d),
  updateMeeting:  (id, d)     => api.patch(`/meetings/${id}`, d),
  deleteMeeting:  (id)        => api.delete(`/meetings/${id}`),

  // Épicas
  getEpics:    (projectId) => api.get('/epics', { params: { project: projectId } }),
  createEpic:  (d)         => api.post('/epics', d),
  updateEpic:  (id, d)     => api.patch(`/epics/${id}`, d),
  deleteEpic:  (id)        => api.delete(`/epics/${id}`),

  // Impedimentos
  getImpediments:   (projectId, params) => api.get('/impediments', { params: { project: projectId, ...params } }),
  createImpediment: (d)                 => api.post('/impediments', d),
  updateImpediment: (id, d)             => api.patch(`/impediments/${id}`, d),
  deleteImpediment: (id)                => api.delete(`/impediments/${id}`),

  // Definition of Done
  getDod:    (projectId)          => api.get(`/projects/${projectId}/dod`),
  updateDod: (projectId, criteria) => api.put(`/projects/${projectId}/dod`, { criteria }),

  // Sprint Review
  getSprintReview:    (sprintId) => api.get(`/sprints/${sprintId}/review`),
  updateSprintReview: (sprintId, d) => api.put(`/sprints/${sprintId}/review`, d),

  // Sprint Retrospectiva
  getSprintRetro:    (sprintId) => api.get(`/sprints/${sprintId}/retro`),
  updateSprintRetro: (sprintId, d) => api.put(`/sprints/${sprintId}/retro`, d),

  // Subtasks
  getSubtasks:    (taskId)     => api.get(`/tasks/${taskId}/subtasks`),
  createSubtask:  (taskId, d)  => api.post(`/tasks/${taskId}/subtasks`, d),
  updateSubtask:  (id, d)      => api.patch(`/subtasks/${id}`, d),
  deleteSubtask:  (id)         => api.delete(`/subtasks/${id}`),

  // Task Attachments
  getAttachments:    (taskId)      => api.get(`/tasks/${taskId}/attachments`),
  uploadAttachment:  (taskId, fd)  => api.post(`/tasks/${taskId}/attachments`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
  deleteAttachment:  (id)          => api.delete(`/attachments/${id}`),
  downloadAttachment:       (id) => api.get(`/attachments/${id}/download`, { responseType: 'blob' }),
  getAttachmentDownloadUrl: (id) => `${api.defaults.baseURL}/attachments/${id}/download`,

  // Comment Reactions
  getReactions:   (commentId)        => api.get(`/comments/${commentId}/reactions`),
  toggleReaction: (commentId, emoji) => api.post(`/comments/${commentId}/reactions`, { emoji }),

  // Reports - time detail
  getTimeReport:  (params) => api.get('/reports/time', { params }),

  // Audit Log
  getAuditLog:    (params) => api.get('/audit', { params }),

  // Project Templates
  getTemplates:           ()            => api.get('/templates'),
  getTemplate:            (id)          => api.get(`/templates/${id}`),
  createTemplate:         (d)           => api.post('/templates', d),
  updateTemplate:         (id, d)       => api.patch(`/templates/${id}`, d),
  deleteTemplate:         (id)          => api.delete(`/templates/${id}`),
  saveProjectAsTemplate:  (templateId, projectId) => api.post(`/templates/${templateId}/save-from-project`, { project_id: projectId }),
  createProjectFromTemplate: (templateId, d)      => api.post(`/templates/${templateId}/create-project`, d),

  // Portfolio
  getPortfolio: () => api.get('/portfolio'),

  // AI
  getAISummary:  (projectId) => api.post(`/projects/${projectId}/ai-summary`),
  getAIRisks:    (projectId) => api.post(`/projects/${projectId}/ai-risks`),

  // Analytics
  getCFD:            (projectId, params) => api.get(`/projects/${projectId}/cfd`, { params }),
  getLeadTime:       (projectId)         => api.get(`/projects/${projectId}/lead-time`),
  getRiskMatrix:     (projectId)         => api.get(`/projects/${projectId}/risk-matrix`),
  getVelocityTrend:  (projectId)         => api.get(`/projects/${projectId}/velocity-trend`),
  getProfitability:  (projectId)         => api.get(`/projects/${projectId}/profitability`),

  // Invoice
  getInvoice: (projectId, params) => api.get(`/projects/${projectId}/invoice`, { params }),

  // Labels
  getLabels:      (projectId)          => api.get(`/projects/${projectId}/labels`),
  createLabel:    (projectId, d)       => api.post(`/projects/${projectId}/labels`, d),
  updateLabel:    (id, d)              => api.patch(`/labels/${id}`, d),
  deleteLabel:    (id)                 => api.delete(`/labels/${id}`),
  getTaskLabels:  (taskId)             => api.get(`/tasks/${taskId}/labels`),
  attachLabel:    (taskId, labelId)    => api.post(`/tasks/${taskId}/labels`, { label_id: labelId }),
  detachLabel:    (taskId, labelId)    => api.delete(`/tasks/${taskId}/labels/${labelId}`),

  // Task Templates
  getTaskTemplates:    (projectId)     => api.get(`/projects/${projectId}/task-templates`),
  createTaskTemplate:  (projectId, d)  => api.post(`/projects/${projectId}/task-templates`, d),
  updateTaskTemplate:  (id, d)         => api.patch(`/task-templates/${id}`, d),
  deleteTaskTemplate:  (id)            => api.delete(`/task-templates/${id}`),
  applyTaskTemplate:   (id, d)         => api.post(`/task-templates/${id}/apply`, d),

  // Planning Poker
  getPokerSessions:  (projectId)  => api.get(`/projects/${projectId}/poker`),
  createPokerSession:(projectId, d)=> api.post(`/projects/${projectId}/poker`, d),
  getPokerSession:   (id)          => api.get(`/poker/${id}`),
  pokerVote:         (id, vote)    => api.post(`/poker/${id}/vote`, { vote }),
  pokerReveal:       (id)          => api.post(`/poker/${id}/reveal`),
  pokerClose:        (id, d)       => api.post(`/poker/${id}/close`, d),

  // 2FA
  get2FASetup:    ()     => api.get('/2fa/setup'),
  enable2FA:      (code) => api.post('/2fa/enable', { code }),
  disable2FA:     (code) => api.post('/2fa/disable', { code }),
  verify2FA:      (code) => api.post('/2fa/verify', { code }),

  // Sessions
  getSessions:      ()   => api.get('/sessions'),
  revokeSession:    (id) => api.delete(`/sessions/${id}`),
  revokeAllSessions:()   => api.delete('/sessions'),

  // Custom Roles
  getRoles:           ()     => api.get('/roles'),
  createRole:         (d)    => api.post('/roles', d),
  updateRole:         (id,d) => api.patch(`/roles/${id}`, d),
  deleteRole:         (id)   => api.delete(`/roles/${id}`),
  getRolePermissions: ()     => api.get('/roles/permissions'),

  // OKRs
  getOKRs:       (params) => api.get('/okrs', { params }),
  createOKR:     (d)      => api.post('/okrs', d),
  updateOKR:     (id, d)  => api.patch(`/okrs/${id}`, d),
  deleteOKR:     (id)     => api.delete(`/okrs/${id}`),
  createKR:      (okrId, d) => api.post(`/okrs/${okrId}/key-results`, d),
  updateKR:      (id, d)    => api.patch(`/key-results/${id}`, d),
  deleteKR:      (id)       => api.delete(`/key-results/${id}`),

  // Capacity planning
  getCapacity:  (sprintId)    => api.get(`/sprints/${sprintId}/capacity`),
  saveCapacity: (sprintId, d) => api.put(`/sprints/${sprintId}/capacity`, d),

  // Chat
  getChat:      (projectId, since) => api.get(`/projects/${projectId}/chat`, { params: since ? { since } : {} }),
  sendChat:     (projectId, body)  => api.post(`/projects/${projectId}/chat`, { body }),
  deleteChat:   (id)               => api.delete(`/chat/${id}`),

  // Wiki
  getWiki:      (projectId)   => api.get(`/projects/${projectId}/wiki`),
  getWikiPage:  (id)          => api.get(`/wiki/${id}`),
  createWikiPage:(projectId,d)=> api.post(`/projects/${projectId}/wiki`, d),
  updateWikiPage:(id, d)      => api.patch(`/wiki/${id}`, d),
  deleteWikiPage:(id)         => api.delete(`/wiki/${id}`),

  // Webhooks
  getWebhooks:    (params) => api.get('/webhooks', { params }),
  createWebhook:  (d)      => api.post('/webhooks', d),
  updateWebhook:  (id, d)  => api.patch(`/webhooks/${id}`, d),
  deleteWebhook:  (id)     => api.delete(`/webhooks/${id}`),
  testWebhook:    (id)     => api.post(`/webhooks/${id}/test`),

  // Import
  importCSV:  (projectId, fd) => api.post(`/projects/${projectId}/import/csv`, fd),
  importJira: (projectId, fd) => api.post(`/projects/${projectId}/import/jira`, fd),

  // Export
  getExcelData: (projectId) => api.get(`/projects/${projectId}/export/excel`),

  // Automations
  getAutomationMeta:    ()            => api.get('/automations/meta'),
  getAutomations:       (pId)         => api.get(`/projects/${pId}/automations`),
  createAutomation:     (pId, d)      => api.post(`/projects/${pId}/automations`, d),
  updateAutomation:     (id, d)       => api.patch(`/automations/${id}`, d),
  deleteAutomation:     (id)          => api.delete(`/automations/${id}`),
  toggleAutomation:     (id)          => api.post(`/automations/${id}/toggle`),
  getAutomationLogs:    (id)          => api.get(`/automations/${id}/logs`),

  // Custom Fields
  getCustomFields:      (pId)         => api.get(`/projects/${pId}/custom-fields`),
  createCustomField:    (pId, d)      => api.post(`/projects/${pId}/custom-fields`, d),
  updateCustomField:    (id, d)       => api.patch(`/custom-fields/${id}`, d),
  deleteCustomField:    (id)          => api.delete(`/custom-fields/${id}`),
  getTaskCustomValues:  (taskId)      => api.get(`/tasks/${taskId}/custom-values`),
  setTaskCustomValues:  (taskId, d)   => api.put(`/tasks/${taskId}/custom-values`, d),

  // Custom Statuses
  getProjectStatuses:   (pId)         => api.get(`/projects/${pId}/statuses`),
  createProjectStatus:  (pId, d)      => api.post(`/projects/${pId}/statuses`, d),
  updateProjectStatus:  (id, d)       => api.patch(`/project-statuses/${id}`, d),
  deleteProjectStatus:  (id)          => api.delete(`/project-statuses/${id}`),

  // Saved Filters
  getSavedFilters:      (params)      => api.get('/saved-filters', { params }),
  createSavedFilter:    (d)           => api.post('/saved-filters', d),
  deleteSavedFilter:    (id)          => api.delete(`/saved-filters/${id}`),

  // Releases
  getReleases:          (pId)         => api.get(`/projects/${pId}/releases`),
  createRelease:        (pId, d)      => api.post(`/projects/${pId}/releases`, d),
  updateRelease:        (id, d)       => api.patch(`/releases/${id}`, d),
  deleteRelease:        (id)          => api.delete(`/releases/${id}`),
  getReleaseTasks:      (id)          => api.get(`/releases/${id}/tasks`),
  addReleaseTasks:      (id, ids)     => api.post(`/releases/${id}/tasks`, { task_ids: ids }),
  generateChangelog:    (id)          => api.post(`/releases/${id}/generate-changelog`),

  // Standup
  getStandup:           (pId)         => api.get(`/projects/${pId}/standup`),
  createStandupQ:       (pId, d)      => api.post(`/projects/${pId}/standup/questions`, d),
  deleteStandupQ:       (id)          => api.delete(`/standup/questions/${id}`),
  answerStandup:        (qId, answer) => api.post(`/standup/${qId}/answer`, { answer }),
  getStandupHistory:    (pId, days)   => api.get(`/projects/${pId}/standup/history`, { params: { days } }),

  // Weekly Reports
  getWeeklyReports:     (pId)         => api.get(`/projects/${pId}/weekly-reports`),
  createWeeklyReport:   (pId, d)      => api.post(`/projects/${pId}/weekly-reports`, d),
  updateWeeklyReport:   (id, d)       => api.patch(`/weekly-reports/${id}`, d),
  deleteWeeklyReport:   (id)          => api.delete(`/weekly-reports/${id}`),

  // SLA
  getSLAPolicies:       (pId)         => api.get(`/projects/${pId}/sla/policies`),
  createSLAPolicy:      (pId, d)      => api.post(`/projects/${pId}/sla/policies`, d),
  updateSLAPolicy:      (id, d)       => api.patch(`/sla/policies/${id}`, d),
  deleteSLAPolicy:      (id)          => api.delete(`/sla/policies/${id}`),
  getSLADashboard:      (pId)         => api.get(`/projects/${pId}/sla/dashboard`),

  // Announcements
  getAnnouncements:     (pId)         => api.get(`/projects/${pId}/announcements`),
  createAnnouncement:   (pId, d)      => api.post(`/projects/${pId}/announcements`, d),
  updateAnnouncement:   (id, d)       => api.patch(`/announcements/${id}`, d),
  deleteAnnouncement:   (id)          => api.delete(`/announcements/${id}`),
  markAnnouncementRead: (id)          => api.post(`/announcements/${id}/read`),

  // Dashboard Widgets
  getDashboardWidgets:  ()            => api.get('/dashboard-widgets'),
  saveDashboardWidgets: (widgets)     => api.post('/dashboard-widgets', { widgets }),

  // Git Integration
  getGitIntegrations:   (pId)         => api.get(`/projects/${pId}/git`),
  createGitIntegration: (pId, d)      => api.post(`/projects/${pId}/git`, d),
  deleteGitIntegration: (id)          => api.delete(`/git/${id}`),
  getGitCommits:        (pId)         => api.get(`/projects/${pId}/git/commits`),

  // IP Allowlist
  getIPAllowlist:       ()            => api.get('/ip-allowlist'),
  createIPRule:         (d)           => api.post('/ip-allowlist', d),
  updateIPRule:         (id, d)       => api.patch(`/ip-allowlist/${id}`, d),
  deleteIPRule:         (id)          => api.delete(`/ip-allowlist/${id}`),

  // Doc Signatures
  getDocSignatures:     (docId)       => api.get(`/technicaldocs/${docId}/signatures`),
  signDocument:         (docId)       => api.post(`/technicaldocs/${docId}/sign`),
  verifyDocSignature:   (docId, hash) => api.get(`/technicaldocs/${docId}/verify`, { params: { hash } }),

  // Description History (#24)
  getDescriptionHistory:   (taskId)           => api.get(`/tasks/${taskId}/description-history`),
  restoreDescriptionVersion:(taskId, vId)     => api.post(`/tasks/${taskId}/description-history/${vId}/restore`),

  // File Annotations (#14)
  getFileAnnotations:    (docId)      => api.get(`/documents/${docId}/annotations`),
  createFileAnnotation:  (docId, d)   => api.post(`/documents/${docId}/annotations`, d),
  updateFileAnnotation:  (id, d)      => api.patch(`/annotations/${id}`, d),
  deleteFileAnnotation:  (id)         => api.delete(`/annotations/${id}`),
  resolveFileAnnotation: (id)         => api.patch(`/annotations/${id}/resolve`),
};
