import api from './api';

export const attendanceAPI = {
  // ── Todos los usuarios autenticados ───────────────────────────────────────
  status:    ()        => api.get('/attendance/status'),
  checkIn:   (payload) => api.post('/attendance/check-in', payload),
  checkOut:  (payload) => api.post('/attendance/check-out', payload),
  myRecords: (params)  => api.get('/attendance/my', { params }),
  getLocations: ()     => api.get('/attendance/locations'),

  // ── Solo admin ────────────────────────────────────────────────────────────
  today:        ()           => api.get('/admin/attendance/today'),
  usersList:    ()           => api.get('/admin/attendance/users-list'),
  allRecords:   (params)     => api.get('/admin/attendance/records', { params }),
  createRecord: (data)       => api.post('/admin/attendance/records', data),
  updateRecord: (id, data)   => api.patch(`/admin/attendance/records/${id}`, data),
  deleteRecord: (id)         => api.delete(`/admin/attendance/records/${id}`),
  createLocation: (data)     => api.post('/admin/attendance/locations', data),
  updateLocation: (id, data) => api.patch(`/admin/attendance/locations/${id}`, data),
  deleteLocation: (id)       => api.delete(`/admin/attendance/locations/${id}`),
  // Reporte mensual
  report: (params)           => api.get('/admin/attendance/report', { params }),
};

// ── Horarios laborales (admin) ────────────────────────────────────────────────
export const scheduleAPI = {
  getDefault:      ()         => api.get('/admin/work-schedule'),
  saveDefault:     (data)     => api.put('/admin/work-schedule', data),
  getForUser:      (id)       => api.get(`/admin/work-schedule/user/${id}`),
  saveForUser:     (id, data) => api.put(`/admin/work-schedule/user/${id}`, data),
  deleteForUser:   (id)       => api.delete(`/admin/work-schedule/user/${id}`),
};

// ── Solicitudes de permiso ────────────────────────────────────────────────────
export const leaveAPI = {
  my:      (params)   => api.get('/leave-requests/my', { params }),
  create:  (data)     => api.post('/leave-requests', data),
  cancel:  (id)       => api.delete(`/leave-requests/${id}`),
  // Admin
  all:     (params)   => api.get('/admin/leave-requests', { params }),
  approve: (id, data) => api.patch(`/admin/leave-requests/${id}/approve`, data),
  reject:  (id, data) => api.patch(`/admin/leave-requests/${id}/reject`, data),
};

// ── Presupuesto de proyecto ───────────────────────────────────────────────────
export const budgetAPI = {
  get:    (projectId)       => api.get(`/projects/${projectId}/budget`),
  create: (projectId, data) => api.post(`/projects/${projectId}/budget`, data),
  update: (id, data)        => api.patch(`/budget/${id}`, data),
  delete: (id)              => api.delete(`/budget/${id}`),
};

// ── Cronograma de pagos ───────────────────────────────────────────────────────
export const paymentsAPI = {
  get:      (projectId)       => api.get(`/projects/${projectId}/payments`),
  create:   (projectId, data) => api.post(`/projects/${projectId}/payments`, data),
  update:   (id, data)        => api.patch(`/payments/${id}`, data),
  markPaid: (id, data)        => api.patch(`/payments/${id}/mark-paid`, data),
  delete:   (id)              => api.delete(`/payments/${id}`),
};
