import api from './api';

export const accessRequestsAPI = {
  // ── Usuario ───────────────────────────────────────────────────────────────
  my:     ()           => api.get('/access-requests/my'),
  check:  (params)     => api.get('/access-requests/check', { params }),
  create: (data)       => api.post('/access-requests', data),
  cancel: (id)         => api.delete(`/access-requests/${id}`),

  // ── Admin / Director ──────────────────────────────────────────────────────
  all:     (params)    => api.get('/admin/access-requests', { params }),
  pending: ()          => api.get('/admin/access-requests/pending'),
  approve: (id, data)  => api.patch(`/admin/access-requests/${id}/approve`, data),
  reject:  (id, data)  => api.patch(`/admin/access-requests/${id}/reject`, data),
};
