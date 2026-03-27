import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;

export const checkPorteria = (email) =>
    axios.get(`${API_URL}/porteria/check`, { params: { email } });

export const getPendientes = (email) =>
    axios.get(`${API_URL}/porteria/pendientes`, { params: { email } });

export const completeMovimiento = (id, { email, horaCompletado, observacionPorteria, vigilador }) =>
    axios.put(`${API_URL}/porteria/${id}/complete`, { email, horaCompletado, observacionPorteria, vigilador });

export const getHistorial = (email, { desde, hasta, estado, page, persona, autorizante, tipo, motivo, origen, destino } = {}) =>
    axios.get(`${API_URL}/porteria/historial`, {
        params: { email, desde, hasta, estado, page, persona, autorizante, tipo, motivo, origen, destino },
    });

export const getPorteros = () =>
    axios.get(`${API_URL}/masters/porteros`);

export const updateTime = (id, email, nuevaHora) =>
    axios.put(`${API_URL}/porteria/${id}/update-time`, { email, nuevaHora });

