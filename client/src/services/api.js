import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5001/api'),
});

export const MastersService = {
    getLegajos: (page = 1, search = '', limit = null, activeOnly = false, sortBy = 'apellido_nombre', sortOrder = 'ASC') => 
        api.get(`/masters/legajos?page=${page}&search=${encodeURIComponent(search)}${limit ? `&limit=${limit}` : ''}${activeOnly ? '&activeOnly=true' : ''}&sortBy=${sortBy}&sortOrder=${sortOrder}`),
    getLugares: () => api.get('/masters/lugares'),
    getMovementTypes: () => api.get('/masters/movement-types'),
    getMovementStates: () => api.get('/masters/movement-states'),
    getMe: (email) => api.get(`/masters/me?email=${email}`),
    getPorteros: () => api.get('/masters/porteros'),
    updateLegajo: (id, data) => api.put(`/masters/legajos/${id}`, data),
    createLegajo: (data) => api.post('/masters/legajos', data),
    deleteLegajo: (id) => api.delete(`/masters/legajos/${id}`),
};

export const MovementsService = {
    getAll: () => api.get('/movements'),
    create: (data) => api.post('/movements', data),
    getMisSolicitudes: (email, page = 1, filtro = 'todos') =>
        api.get(`/movements/mis-solicitudes?email=${encodeURIComponent(email)}&page=${page}&filtro=${filtro}`),
    approve: (id, email) => api.put(`/movements/${id}/approve`, { email }),
    reject: (id, email, observacion) => api.put(`/movements/${id}/reject`, { email, observacion }),
    cancel: (id, email, observacion) => api.put(`/movements/${id}/cancel`, { email, observacion }),
    getStatus: (id) => api.get(`/movements/${id}/status`),
};

export const SupportService = {
    sendFeedback: (data) => api.post('/support/feedback', data),
    getFaqs: () => api.get('/support/faqs'),
    getVideos: () => api.get('/support/videos'),
};

export const SystemService = {
    getVersion: (v) => api.get(`/system/version${v ? `?v=${v}` : ''}`),
};

export default api;
