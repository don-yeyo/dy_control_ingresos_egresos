import React, { useState, useCallback } from 'react';
import { useAuth } from '../../config/AuthContext';
import { Download, Search, Edit2, Check as CheckIcon, X as XIcon } from 'lucide-react';
import * as XLSX from 'xlsx';
import { getHistorial, updateTime } from '../../services/porteriaService';
import './Historial.css';

function nDaysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
}

// Extrae la fecha YYYY-MM-DD del campo datetime usando el timezone local
const extraerFechaStr = (fechaHoraRegistro) => {
    if (!fechaHoraRegistro) return null;
    const s = String(fechaHoraRegistro);
    if (!s.includes('T')) return s.substring(0, 10);
    const date = new Date(fechaHoraRegistro);
    if (isNaN(date.getTime())) return s.substring(0, 10);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

// Extrae la hora HH:mm del campo datetime usando el timezone local
const extraerHoraStr = (fechaHoraRegistro) => {
    if (!fechaHoraRegistro) return null;
    const s = String(fechaHoraRegistro);
    if (!s.includes('T') && s.includes(' ')) {
        return s.split(' ')[1].substring(0, 5);
    }
    const date = new Date(fechaHoraRegistro);
    if (isNaN(date.getTime())) return null;
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

// Un movimiento es "vencido visual" si está Pendiente y su fecha de registro ya pasó
function isVencidoVisual(m) {
    if (m.estado_nombre !== 'Pendiente') return false;
    const movDateStr = extraerFechaStr(m.fechaHoraRegistro);
    if (!movDateStr) return false;
    const todayStr = new Date().toLocaleDateString('en-CA');
    return movDateStr < todayStr;
}

const ESTADOS = [
    { value: 'todos', label: 'Todos' },
    { value: '1', label: 'Pendiente' },
    { value: 'vencido_visual', label: 'Vencido (sin completar)' },
    { value: '2', label: 'Completado' },
    { value: '3', label: 'Vencido (expirado)' },
    { value: '4', label: 'Solicitado' },
    { value: '5', label: 'Rechazado' },
    { value: '6', label: 'Anulado' },
];

const ESTADO_COLORS = {
    'Pendiente': { bg: 'rgba(99,102,241,0.15)', color: '#818cf8' },
    'Pendiente (vencido)': { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
    'Completado': { bg: 'rgba(16,185,129,0.15)', color: '#10b981' },
    'Vencido': { bg: 'rgba(107,114,128,0.15)', color: '#9ca3af' },
    'Solicitado': { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
    'Rechazado': { bg: 'rgba(239,68,68,0.15)', color: '#ef4444' },
    'Anulado': { bg: 'rgba(139,92,246,0.15)', color: '#a78bfa' },
};

function formatFecha(str, conHora = false) {
    if (!str) return '—';
    const fecha = extraerFechaStr(str);
    if (!fecha) return str;
    const dmy = fecha.split('-').reverse().join('/');
    if (conHora) {
        const hora = extraerHoraStr(str);
        return hora ? `${dmy} ${hora}` : dmy;
    }
    return dmy;
}

function Historial({ porteria }) {
    const { user } = useAuth();
    const email = user?.email;

    const today = new Date().toISOString().slice(0, 10);
    const [desde, setDesde] = useState(nDaysAgo(3));
    const [hasta, setHasta] = useState(today);
    const [estado, setEstado] = useState('todos'); // Últimos 3 días, todos los estados
    const [page, setPage] = useState(1);

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState('');
    const [editing, setEditing] = useState(null); // { id: 1, time: '12:34' }

    const fetchData = useCallback(async (p = 1) => {
        setLoading(true);
        setError('');
        // Para el filtro 'vencido_visual' pedimos estado pendiente al backend
        const estadoApi = estado === 'vencido_visual' ? '1' : estado;
        try {
            const res = await getHistorial(email, { desde, hasta, estado: estadoApi, page: p });
            // Filtrado local de vencidos visuales
            if (estado === 'vencido_visual') {
                res.data.movements = res.data.movements.filter(isVencidoVisual);
            }
            setData(res.data);
            setPage(p);
        } catch (e) {
            setError(e.response?.data?.error || 'Error al cargar el historial');
        } finally {
            setLoading(false);
        }
    }, [email, desde, hasta, estado]);

    const handleSearch = () => fetchData(1);

    const handleSaveTime = async (id) => {
        if (!editing || !editing.time) return;
        try {
            await updateTime(id, email, editing.time);
            setEditing(null);
            fetchData(page);
        } catch (e) {
            alert(e.response?.data?.error || 'Error al actualizar la hora');
        }
    };

    // Exportar a Excel con TODOS los registros de los filtros actuales
    const handleExport = async () => {
        setExporting(true);
        try {
            // Traer todos los registros del filtro (página por página)
            let allRows = [];
            let p = 1, totalPages = 1;
            // Para el filtro 'vencido_visual' pedimos estado pendiente al backend
            const estadoApi = estado === 'vencido_visual' ? '1' : estado;

            do {
                const res = await getHistorial(email, { desde, hasta, estado: estadoApi, page: p });
                let pageMovs = res.data.movements;

                // Filtrado local de vencidos visuales
                if (estado === 'vencido_visual') {
                    pageMovs = pageMovs.filter(isVencidoVisual);
                }

                allRows = [...allRows, ...pageMovs];
                totalPages = res.data.pagination.totalPages;
                p++;
            } while (p <= totalPages);

            const rows = allRows.map(m => ({
                'ID': m.id,
                'Fecha': formatFecha(m.fechaHoraCompletado || m.fechaHoraRegistro, m.estado_nombre === 'Completado'),
                'Tipo': m.tipo_nombre,
                'Persona': m.persona_interna_nombre || m.idPersonaExterna || '',
                'Origen': m.origen_nombre,
                'Destino': m.destino_nombre,
                'Estado': m.estado_nombre,
                'Autorizante': m.autorizante_nombre || '',
                'Motivo': m.motivo || '',
                'Observación': m.observacion || '',
                'Obs. Portería': m.observacionPorteria || '',
            }));

            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Historial');
            XLSX.writeFile(wb, `historial_porteria_${desde}_${hasta}.xlsx`);
        } catch (e) {
            alert('Error al exportar');
        } finally {
            setExporting(false);
        }
    };

    const movements = data?.movements || [];
    const pagination = data?.pagination;

    return (
        <div style={{ padding: '20px 16px', maxWidth: 1000, margin: '0 auto' }}>
            <div className="historial-header">
                <h1>Historial de movimientos</h1>
                <span className="subtitle">{porteria?.nombre}</span>
            </div>

            {/* Filtros */}
            <div className="filtros-bar">
                <div className="filtro-group">
                    <label>Desde</label>
                    <input type="date" value={desde} onChange={e => setDesde(e.target.value)} />
                </div>
                <div className="filtro-group">
                    <label>Hasta</label>
                    <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} />
                </div>
                <div className="filtro-group">
                    <label>Estado</label>
                    <select value={estado} onChange={e => setEstado(e.target.value)}>
                        {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                    </select>
                </div>
                <button className="btn-buscar" onClick={handleSearch} disabled={loading}>
                    <Search size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    {loading ? 'Buscando...' : 'Buscar'}
                </button>
                <button className="btn-export" onClick={handleExport} disabled={exporting || !data || movements.length === 0}>
                    <Download size={14} />
                    {exporting ? 'Exportando...' : 'Exportar Excel'}
                </button>
            </div>

            {error && <p style={{ color: 'var(--dy-red)', marginBottom: 16 }}>{error}</p>}

            {/* Tabla */}
            {data && (
                <>
                    <div className="historial-table-wrap">
                        <table className="historial-table">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Persona</th>
                                    <th>Tipo</th>
                                    <th>Motivo</th>
                                    <th>Origen → Destino</th>
                                    <th>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {movements.length === 0 && (
                                    <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>Sin resultados</td></tr>
                                )}
                                {movements.map(m => {
                                    const vencidoVisual = isVencidoVisual(m);
                                    const estadoLabel = vencidoVisual ? 'Pendiente (vencido)' : m.estado_nombre;
                                    const colors = ESTADO_COLORS[estadoLabel] || ESTADO_COLORS[m.estado_nombre] || {};
                                    return (
                                        <tr key={m.id}>
                                            <td style={{ whiteSpace: 'nowrap' }}>
                                                {m.estado_nombre === 'Completado' ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        {editing?.id === m.id ? (
                                                            <>
                                                                <span style={{ fontSize: '0.9rem' }}>{formatFecha(m.fechaHoraCompletado || m.fechaHoraRegistro)}</span>
                                                                <input
                                                                    type="time"
                                                                    value={editing.time}
                                                                    onChange={e => setEditing({ ...editing, time: e.target.value })}
                                                                    className="edit-time-input"
                                                                    autoFocus
                                                                />
                                                                <button onClick={() => handleSaveTime(m.id)} className="btn-icon-save" title="Guardar">
                                                                    <CheckIcon size={14} />
                                                                </button>
                                                                <button onClick={() => setEditing(null)} className="btn-icon-cancel" title="Cancelar">
                                                                    <XIcon size={14} />
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                {formatFecha(m.fechaHoraCompletado || m.fechaHoraRegistro, true)}
                                                                <button
                                                                    className="btn-edit-inline"
                                                                    onClick={() => setEditing({ id: m.id, time: extraerHoraStr(m.fechaHoraCompletado || m.fechaHoraRegistro) })}
                                                                    title="Corregir hora"
                                                                >
                                                                    <Edit2 size={12} />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                ) : (
                                                    formatFecha(m.fechaHoraCompletado || m.fechaHoraRegistro, false)
                                                )}
                                            </td>
                                            <td>{m.persona_interna_nombre || m.idPersonaExterna || '—'}</td>
                                            <td>{m.tipo_nombre}</td>
                                            <td style={{ fontSize: '0.85rem' }}>{m.motivo}</td>
                                            <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{m.origen_nombre} → {m.destino_nombre}</td>
                                            <td>
                                                <span className="estado-badge" style={{ background: colors.bg, color: colors.color }}>
                                                    {estadoLabel}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Paginación */}
                    {pagination && pagination.totalPages > 1 && (
                        <div className="pagination">
                            <button disabled={page <= 1} onClick={() => fetchData(page - 1)}>← Anterior</button>
                            <span>Pág. {pagination.page} / {pagination.totalPages} · {pagination.total} registros</span>
                            <button disabled={page >= pagination.totalPages} onClick={() => fetchData(page + 1)}>Siguiente →</button>
                        </div>
                    )}
                    {pagination && pagination.totalPages <= 1 && data && (
                        <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 12 }}>
                            {pagination.total} {pagination.total === 1 ? 'registro' : 'registros'}
                        </p>
                    )}
                </>
            )}

            {!data && !loading && (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', paddingTop: 40 }}>
                    Seleccioná los filtros y presioná Buscar.
                </p>
            )}
        </div>
    );
}

export default Historial;
