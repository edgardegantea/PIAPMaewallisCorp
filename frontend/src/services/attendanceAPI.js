import api from './api';

export const attendanceAPI = {
  // ── User ──────────────────────────────────────────────────────────────────
  status:   ()           => api.get('/attendance/status'),
  checkIn:  (payload)    => api.post('/attendance/check-in', payload),
  checkOut: (payload)    => api.post('/attendance/check-out', payload),
  myRecords:(params)     => api.get('/attendance/my', { params }),

  // ── Admin ─────────────────────────────────────────────────────────────────
  allRecords:     (params)   => api.get('/attendance/records', { params }),
  updateRecord:   (id, data) => api.patch(`/attendance/records/${id}`, data),

  // Locations
  getLocations:   ()         => api.get('/attendance/locations'),
  createLocation: (data)     => api.post('/admin/attendance/locations', data),
  updateLocation: (id, data) => api.patch(`/admin/attendance/locations/${id}`, data),
  deleteLocation: (id)       => api.delete(`/admin/attendance/locations/${id}`),
};
