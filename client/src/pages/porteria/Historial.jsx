import React, { useState, useCallback } from 'react';
import { useAuth } from '../../config/AuthContext';
import { Download, Search, Edit2, Check as CheckIcon, X as XIcon, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import * as XLSX from 'xlsx';
import { getHistorial, updateTime } from '../../services/porteriaService';
import { MastersService } from '../../services/api';
import { Autocomplete, Select } from '../../components/FormElements';
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
    const [estado, setEstado] = useState('todos');
    const [persona, setPersona] = useState('');
    const [autorizante, setAutorizante] = useState('');
    const [tipo, setTipo] = useState('');
    const [motivo, setMotivo] = useState('');
    const [origen, setOrigen] = useState('');
    const [destino, setDestino] = useState('');
    const [page, setPage] = useState(1);

    const [legajos, setLegajos] = useState([]);
    const [autorizadores, setAutorizadores] = useState([]);
    const [lugares, setLugares] = useState([]);
    const [tipos, setTipos] = useState([]);
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState('');
    const [editing, setEditing] = useState(null); // { id: 1, time: '12:34' }

    React.useEffect(() => {
        const fetchMasters = async () => {
            try {
                const [lRes, lugRes, tRes] = await Promise.all([
                    MastersService.getLegajos(1, '', 5000), // Traer todos los legajos para el historial (activos e inactivos)
                    MastersService.getLugares(),
                    MastersService.getMovementTypes()
                ]);
                const lArray = lRes.data.data || (Array.isArray(lRes.data) ? lRes.data : []);
                setLegajos(lArray.map(item => ({ ...item })));
                setAutorizadores(lArray.filter(i => i.esAutorizador === 1));

                setLugares(lugRes.data.data || (Array.isArray(lugRes.data) ? lugRes.data : []));
                setTipos(tRes.data.data || (Array.isArray(tRes.data) ? tRes.data : []));
            } catch(e) {
                console.error("Error al obtener tablas maestras para filtros locales:", e);
            }
        };
        fetchMasters();
    }, []);

    const fetchData = useCallback(async (p = 1) => {
        setLoading(true);
        setError('');
        // Para el filtro 'vencido_visual' pedimos estado pendiente al backend
        const estadoApi = estado === 'vencido_visual' ? '1' : estado;
        try {
            const res = await getHistorial(email, { desde, hasta, estado: estadoApi, page: p, persona, autorizante, tipo, motivo, origen, destino });
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
    }, [email, desde, hasta, estado, persona, autorizante, tipo, motivo, origen, destino]);

    React.useEffect(() => {
        if (email) {
            fetchData(1);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [email]);

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
                const res = await getHistorial(email, { desde, hasta, estado: estadoApi, page: p, persona, autorizante, tipo, motivo, origen, destino });
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
            <div className="filtros-bar" style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--surface)', padding: '16px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
                        <div className="filtro-group">
                            <label style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 500 }}>Desde</label>
                            <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={{ minHeight: '46px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0 12px' }} />
                        </div>
                        <div className="filtro-group">
                            <label style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 500 }}>Hasta</label>
                            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={{ minHeight: '46px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0 12px' }} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
                        <button className="btn-secondary" onClick={() => setShowAdvancedFilters(true)} style={{ padding: '0 20px', minHeight: '46px', fontSize: '1rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                            <Filter size={18} /> Filtros Avanzados
                        </button>
                        <button className="btn-buscar" onClick={handleSearch} disabled={loading} style={{ padding: '0 24px', minHeight: '46px', fontSize: '1rem', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                            <Search size={18} />
                            {loading ? 'Buscando...' : 'Buscar'}
                        </button>
                        <button className="btn-export" onClick={handleExport} disabled={exporting || !data || movements.length === 0} style={{ padding: '0 24px', minHeight: '46px', fontSize: '1rem', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                            <Download size={18} />
                            {exporting ? 'Exportando...' : 'Excel'}
                        </button>
                    </div>
                </div>

                {showAdvancedFilters && (
                    <div className="modal-overlay" onClick={() => setShowAdvancedFilters(false)}>
                        <div className="modal-content glass card-anim" onClick={e => e.stopPropagation()} style={{ width: '90%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Filtros Avanzados</h2>
                                <button onClick={() => setShowAdvancedFilters(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                                    <XIcon size={24} />
                                </button>
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                                <Select label="Estado del Movimiento" value={estado} onChange={e => setEstado(e.target.value)} name="estado" options={ESTADOS.map(e => ({ id: e.value, label: e.label }))} includePlaceholder={false} />
                                <Autocomplete
                                    label="Persona autorizada"
                                    placeholder="Buscar nombre o DNI..."
                                    value={persona}
                                    onSelect={(opt) => setPersona(opt.id)}
                                    options={legajos.map(l => ({ id: l.apellido_nombre, label: l.apellido_nombre }))}
                                    allowFreeText={true}
                                />
                                <Autocomplete
                                    label="Autorizante"
                                    placeholder="Buscar..."
                                    value={autorizante}
                                    onSelect={(opt) => setAutorizante(opt.id)}
                                    options={autorizadores.map(l => ({ id: l.apellido_nombre, label: l.apellido_nombre }))}
                                    allowFreeText={true}
                                />
                                <Select
                                    label="Tipo"
                                    name="tipo"
                                    value={tipo}
                                    onChange={(e) => setTipo(e.target.value)}
                                    options={tipos.map(t => ({ id: t.nombre, label: t.nombre }))}
                                    includePlaceholder={true}
                                />
                                <Select
                                    label="Motivo"
                                    name="motivo"
                                    value={motivo}
                                    onChange={(e) => setMotivo(e.target.value)}
                                    options={['Motivos personales', 'Requerimiento laboral', 'Accidente o razones médicas', 'Otros'].map(m => ({ id: m, label: m }))}
                                    includePlaceholder={true}
                                />
                                <Select
                                    label="Origen"
                                    name="origen"
                                    value={origen}
                                    onChange={(e) => setOrigen(e.target.value)}
                                    options={lugares.map(l => ({ id: l.nombre, label: l.nombre }))}
                                    includePlaceholder={true}
                                />
                                <Select
                                    label="Destino"
                                    name="destino"
                                    value={destino}
                                    onChange={(e) => setDestino(e.target.value)}
                                    options={lugares.map(l => ({ id: l.nombre, label: l.nombre }))}
                                    includePlaceholder={true}
                                />
                            </div>

                            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                <button className="btn-secondary" onClick={() => {
                                    setEstado('todos'); setPersona(''); setAutorizante(''); setTipo(''); setMotivo(''); setOrigen(''); setDestino('');
                                }} style={{ padding: '0 20px', minHeight: '40px', borderRadius: 'var(--radius)' }}>
                                    Limpiar
                                </button>
                                <button className="btn-primary" onClick={() => { setShowAdvancedFilters(false); handleSearch(); }} style={{ padding: '0 20px', minHeight: '40px', borderRadius: 'var(--radius)' }}>
                                    Aplicar y Buscar
                                </button>
                            </div>
                        </div>
                    </div>
                )}
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
