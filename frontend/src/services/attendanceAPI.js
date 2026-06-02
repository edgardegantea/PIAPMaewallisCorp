import api from './api';

export const attendanceAPI = {
  // ── Todos los usuarios autenticados ───────────────────────────────────────
  status:    ()        => api.get('/attendance/status'),
  checkIn:   (payload) => api.post('/attendance/check-in', payload),
  checkOut:  (payload) => api.post('/attendance/check-out', payload),
  myRecords: (params)  => api.get('/attendance/my', { params }),
  getLocations: ()     => api.get('/attendance/locations'),  // lista para el selector check-in

  // ── Solo admin ────────────────────────────────────────────────────────────
  // Dashboard
  today:     ()        => api.get('/admin/attendance/today'),
  usersList: ()        => api.get('/admin/attendance/users-list'),

  // Registros
  allRecords:   (params)   => api.get('/admin/attendance/records', { params }),
  createRecord: (data)     => api.post('/admin/attendance/records', data),
  updateRecord: (id, data) => api.patch(`/admin/attendance/records/${id}`, data),
  deleteRecord: (id)       => api.delete(`/admin/attendance/records/${id}`),

  // Ubicaciones
  createLocation: (data)     => api.post('/admin/attendance/locations', data),
  updateLocation: (id, data) => api.patch(`/admin/attendance/locations/${id}`, data),
  deleteLocation: (id)       => api.delete(`/admin/attendance/locations/${id}`),
};
