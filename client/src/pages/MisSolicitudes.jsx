import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../config/AuthContext';
import { MovementsService } from '../services/api';
import { Button } from '../components/Button';
import Modal from '../components/Modal';
import {
    Clock, CheckCircle, XCircle, AlertCircle, RefreshCw,
    ChevronDown, ChevronUp, Check, X, User, MapPin, Calendar,
    FileText, ChevronLeft, ChevronRight, AlertTriangle, Package, FileDigit, QrCode
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import CryptoJS from 'crypto-js';
import './MisSolicitudes.css';

const ESTADO_PENDIENTE = 1;
const ESTADO_COMPLETADO = 2;
const ESTADO_VENCIDO = 3;
const ESTADO_SOLICITADO = 4;
const ESTADO_RECHAZADO = 5;
const ESTADO_ANULADO = 6;

// Extrae la fecha YYYY-MM-DD del campo datetime usando el timezone local
const extraerFechaStr = (fechaHoraRegistro) => {
    if (!fechaHoraRegistro) return null;
    const s = String(fechaHoraRegistro);
    if (!s.includes('T')) return s.substring(0, 10); // Si no es ISO, devolver directo
    
    const date = new Date(fechaHoraRegistro);
    if (isNaN(date.getTime())) return s.substring(0, 10);
    
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

// Extrae la hora HH:mm del campo datetime usando el timezone local
const extraerHoraStr = (fechaHoraRegistro) => {
    if (!fechaHoraRegistro) return null;
    const s = String(fechaHoraRegistro);
    if (!s.includes('T') && s.includes(' ')) {
        return s.split(' ')[1].substring(0, 5); // Fallback para strings SQL puros
    }
    
    const date = new Date(fechaHoraRegistro);
    if (isNaN(date.getTime())) return null;
    
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

// Detecta si un movimiento Pendiente cuya fecha ya pasó (vencida visualmente)
const esVencidaVisual = (mov) => {
    if (mov.idEstado !== ESTADO_PENDIENTE) return false;
    const movDateStr = extraerFechaStr(mov.fechaHoraRegistro);
    if (!movDateStr) return false;
    // Comparar strings YYYY-MM-DD directamente, sin pasar por Date() para evitar timezone
    const todayStr = new Date().toLocaleDateString('en-CA'); // siempre "YYYY-MM-DD"
    return movDateStr < todayStr;
};

const estadoConfig = {
    [ESTADO_SOLICITADO]: { label: 'Solicitado', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: <Clock size={14} /> },
    [ESTADO_PENDIENTE]: { label: 'Pendiente', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', icon: <AlertCircle size={14} /> },
    [ESTADO_COMPLETADO]: { label: 'Completado', color: '#22c55e', bg: 'rgba(34,197,94,0.12)', icon: <CheckCircle size={14} /> },
    [ESTADO_VENCIDO]: { label: 'Vencido', color: '#6b7280', bg: 'rgba(107,114,128,0.12)', icon: <XCircle size={14} /> },
    [ESTADO_RECHAZADO]: { label: 'Rechazado', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', icon: <XCircle size={14} /> },
    [ESTADO_ANULADO]: { label: 'Anulado', color: '#a855f7', bg: 'rgba(168,85,247,0.12)', icon: <XCircle size={14} /> },
};

const VENCIDA_VISUAL_CONFIG = { label: 'Vencida', color: '#f97316', bg: 'rgba(249,115,22,0.12)', icon: <AlertTriangle size={14} /> };

const EstadoBadge = ({ mov }) => {
    const vencida = esVencidaVisual(mov);
    const cfg = vencida ? VENCIDA_VISUAL_CONFIG : (estadoConfig[mov.idEstado] || { label: 'Desconocido', color: '#6b7280', bg: 'rgba(0,0,0,0.1)', icon: null });
    return (
        <span className="estado-badge" style={{ color: cfg.color, background: cfg.bg }}>
            {cfg.icon} {cfg.label}
        </span>
    );
};

const GrupoBadge = ({ mov }) => {
    const total = mov.grupo_total || 0;
    if (total <= 1) return null; // singleton, sin grupo
    const completados = mov.grupo_completados || 0;
    const orden = mov.ordenGrupo || 1;
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            fontSize: '0.72rem', fontWeight: '600', padding: '2px 8px',
            borderRadius: '20px', backgroundColor: 'rgba(99,102,241,0.1)',
            color: '#818cf8', border: '1px solid rgba(99,102,241,0.25)',
            whiteSpace: 'nowrap'
        }}>
            🔗 Paso {orden}/{total}{completados > 0 ? ` · ${completados} ✓` : ''}
        </span>
    );
};

const MovimientoCard = ({ mov, esAutorizador, currentUserEmail, onApprove, onReject, onCancel, onShowQR }) => {
    const [expanded, setExpanded] = useState(false);
    const isPendingMyAuth = esAutorizador && mov.idEstado === ESTADO_SOLICITADO;
    const isPendingCancel = 
        (mov.idEstado === ESTADO_PENDIENTE && (esAutorizador || mov.usuario_app === currentUserEmail)) || 
        (mov.idEstado === ESTADO_SOLICITADO && mov.usuario_app === currentUserEmail);
    const vencida = esVencidaVisual(mov);

    // Extraer la fecha como string para evitar conversión UTC → local que resta un día
    const fechaStr = extraerFechaStr(mov.fechaHoraRegistro);
    const fecha = fechaStr
        ? fechaStr.split('-').reverse().join('/') // "YYYY-MM-DD" → "DD/MM/YYYY"
        : '-';

    return (
        <div className={`solicitud-card glass ${isPendingMyAuth ? 'solicitud-card--needs-action' : ''} ${vencida ? 'solicitud-card--vencida' : ''}`}>
            <div className="solicitud-card__header" onClick={() => setExpanded(!expanded)}>
                <div className="solicitud-card__header-left">
                    <span className="solicitud-card__id">#{mov.id}</span>
                    <EstadoBadge mov={mov} />
                    <GrupoBadge mov={mov} />
                    {isPendingMyAuth && (
                        <span className="solicitud-card__action-needed">Requiere tu acción</span>
                    )}
                </div>
                <div className="solicitud-card__header-right">
                    <span className="solicitud-card__tipo">{mov.tipo_nombre}</span>
                    <span style={{
                        fontSize: '0.7rem',
                        fontWeight: '700',
                        padding: '2px 8px',
                        borderRadius: '20px',
                        backgroundColor: 'rgba(139,92,246,0.1)',
                        color: '#a78bfa',
                        border: '1px solid rgba(139,92,246,0.2)',
                        marginLeft: '8px'
                    }}>{mov.motivo}</span>
                    <button className="solicitud-card__expand-btn">
                        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                </div>
            </div>

            <div className="solicitud-card__summary">
                <div className="solicitud-card__meta">
                    <span><User size={13} /> {mov.persona_interna_nombre || mov.personaInterna}</span>
                    <span><MapPin size={13} /> {mov.origen_nombre} → {mov.destino_nombre}</span>
                    <span><Calendar size={13} /> {fecha}</span>
                    {mov.idEstado === ESTADO_COMPLETADO && extraerHoraStr(mov.fechaHoraCompletado || mov.fechaHoraRegistro) && (
                        <span><Clock size={13} /> {extraerHoraStr(mov.fechaHoraCompletado || mov.fechaHoraRegistro)} hs</span>
                    )}
                </div>
            </div>

            {expanded && (
                <div className="solicitud-card__body">
                    <div className="solicitud-card__detail-grid">
                        <div className="solicitud-card__detail-item">
                            <span className="solicitud-card__detail-label">Motivo</span>
                            <span className="solicitud-card__detail-value">{mov.motivo}</span>
                        </div>
                        <div className="solicitud-card__detail-item">
                            <span className="solicitud-card__detail-label">Con Retorno</span>
                            <span className="solicitud-card__detail-value">{mov.conRegreso ? 'Sí' : 'No'}</span>
                        </div>
                        {mov.destinoDetalle && (
                            <div className="solicitud-card__detail-item">
                                <span className="solicitud-card__detail-label">Detalle destino</span>
                                <span className="solicitud-card__detail-value">{mov.destinoDetalle}</span>
                            </div>
                        )}
                        <div className="solicitud-card__detail-item">
                            <span className="solicitud-card__detail-label">Autorizante</span>
                            <span className="solicitud-card__detail-value">{mov.autorizante_nombre || mov.personaAutorizante || '-'}</span>
                        </div>
                        {mov.vigilador && (
                            <div className="solicitud-card__detail-item">
                                <span className="solicitud-card__detail-label">Vigilador</span>
                                <span className="solicitud-card__detail-value">{mov.vigilador}</span>
                            </div>
                        )}
                    </div>
                    {mov.observacion && (
                        <div className="solicitud-card__observacion">
                            <FileText size={13} />
                            <span>{mov.observacion}</span>
                        </div>
                    )}

                    {(mov.articulos?.length > 0 || mov.documentos?.length > 0) && (
                        <div className="solicitud-card__items">
                            {mov.articulos?.length > 0 && (
                                <div className="solicitud-card__items-group">
                                    <h4 className="solicitud-card__items-title"><Package size={14} /> Artículos</h4>
                                    <div className="solicitud-card__items-list">
                                        {mov.articulos.map((art, idx) => (
                                            <div key={`art-${art.id || idx}`} className="solicitud-card__item">
                                                <div className="solicitud-card__item-header">
                                                    <span className="solicitud-card__item-name">{art.descripcion}</span>
                                                    <span className="solicitud-card__item-qty">{art.cantidad} {art.presentacion || 'u.'}</span>
                                                </div>
                                                <div className="solicitud-card__item-details">
                                                    <span className="solicitud-card__item-detail">
                                                        <MapPin size={11} /> {art.origen_nombre} → {art.destino_nombre}
                                                    </span>
                                                    {art.destinatario && (
                                                        <span className="solicitud-card__item-detail">
                                                            <User size={11} /> Dest: {art.destinatario}
                                                        </span>
                                                    )}
                                                    {art.sinRetorno === 1 && (
                                                        <span className="solicitud-card__item-detail" style={{ color: '#ef4444' }}>
                                                            Sin retorno
                                                        </span>
                                                    )}
                                                </div>
                                                {art.observacion && (
                                                    <p className="solicitud-card__item-obs">{art.observacion}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {mov.documentos?.length > 0 && (
                                <div className="solicitud-card__items-group">
                                    <h4 className="solicitud-card__items-title"><FileDigit size={14} /> Documentos</h4>
                                    <div className="solicitud-card__items-list">
                                        {mov.documentos.map((doc, idx) => (
                                            <div key={`doc-${doc.id || idx}`} className="solicitud-card__item">
                                                <div className="solicitud-card__item-header">
                                                    <span className="solicitud-card__item-name">{doc.descripcion}</span>
                                                    <span className="solicitud-card__item-qty">{doc.cantidad} {doc.tipo || 'doc.'}</span>
                                                </div>
                                                <div className="solicitud-card__item-details">
                                                    <span className="solicitud-card__item-detail">
                                                        <MapPin size={11} /> {doc.origen_nombre} → {doc.destino_nombre}
                                                    </span>
                                                    {doc.destinatario && (
                                                        <span className="solicitud-card__item-detail">
                                                            <User size={11} /> Dest: {doc.destinatario}
                                                        </span>
                                                    )}
                                                </div>
                                                {doc.observacion && (
                                                    <p className="solicitud-card__item-obs">{doc.observacion}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {isPendingMyAuth && (
                        <div className="solicitud-card__actions">
                            <Button variant="primary" size="sm" type="button" onClick={() => onApprove(mov)}>
                                <Check size={16} /> Aprobar
                            </Button>
                            <Button variant="ghost" size="sm" type="button"
                                style={{ color: 'var(--error)', border: '1px solid var(--error)' }}
                                onClick={() => onReject(mov)}>
                                <X size={16} /> Rechazar
                            </Button>
                        </div>
                    )}
                    {isPendingCancel && (
                        <div className="solicitud-card__actions">
                            <Button variant="ghost" size="sm" type="button"
                                style={{ color: '#a855f7', border: '1px solid #a855f7' }}
                                onClick={() => onCancel(mov)}>
                                <X size={16} /> Anular
                            </Button>
                        </div>
                    )}
                    {!vencida && mov.idEstado === ESTADO_PENDIENTE && import.meta.env.VITE_ENABLE_QR !== 'false' && (
                        <div className="solicitud-card__qr-section" style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed var(--border)', textAlign: 'center' }}>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); onShowQR(mov); }}
                                style={{ width: '100%', gap: '8px' }}
                            >
                                <QrCode size={18} /> Mostrar Código QR para portería
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};


// Componente de paginación
const Pagination = ({ pagination, onPageChange }) => {
    if (!pagination || pagination.totalPages <= 1) return null;
    const { page, totalPages, total, pageSize } = pagination;

    const desde = (page - 1) * pageSize + 1;
    const hasta = Math.min(page * pageSize, total);

    // Generar páginas visibles: siempre mostrar primera, ultima, y las cercanas a la actual
    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
            pages.push(i);
        } else if (pages[pages.length - 1] !== '...') {
            pages.push('...');
        }
    }

    return (
        <div className="pagination">
            <span className="pagination__info">{desde}–{hasta} de {total}</span>
            <div className="pagination__controls">
                <button
                    className="pagination__btn"
                    disabled={page <= 1}
                    onClick={() => onPageChange(page - 1)}
                    title="Página anterior"
                >
                    <ChevronLeft size={16} />
                </button>

                {pages.map((p, i) => (
                    p === '...'
                        ? <span key={`ellipsis-${i}`} className="pagination__ellipsis">…</span>
                        : <button
                            key={p}
                            className={`pagination__btn ${p === page ? 'active' : ''}`}
                            onClick={() => onPageChange(p)}
                        >
                            {p}
                        </button>
                ))}

                <button
                    className="pagination__btn"
                    disabled={page >= totalPages}
                    onClick={() => onPageChange(page + 1)}
                    title="Página siguiente"
                >
                    <ChevronRight size={16} />
                </button>
            </div>
        </div>
    );
};

const MisSolicitudes = () => {
    const { user } = useAuth();
    const currentUser = user || {};
    const email = currentUser.email || '';

    const [data, setData] = useState({ movements: [], esAutorizador: false, pendingActionCount: 0, pagination: null });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filtro, setFiltro] = useState('todos');
    const [page, setPage] = useState(1);

    const [rejectModal, setRejectModal] = useState({ open: false, mov: null, observacion: '' });
    const [cancelModal, setCancelModal] = useState({ open: false, mov: null, observacion: '' });
    const [approveModal, setApproveModal] = useState({ open: false, mov: null });
    const [qrModal, setQrModal] = useState({ open: false, mov: null, scanned: false });
    const [actionLoading, setActionLoading] = useState(false);
    const [actionResult, setActionResult] = useState(null);

    const generateQRData = (movId) => {
        const secret = 'dy_internal_secret_key_2026_qr';
        const hash = CryptoJS.HmacSHA256(movId.toString(), secret).toString(CryptoJS.enc.Hex).substring(0, 10);
        return `${movId}:${hash}`;
    };

    const fetchData = useCallback(async (currentPage, currentFiltro) => {
        setLoading(true);
        setError(null);
        try {
            const res = await MovementsService.getMisSolicitudes(email, currentPage, currentFiltro);
            setData(res.data);
        } catch (err) {
            setError('No se pudieron cargar las solicitudes. Intente nuevamente.');
        } finally {
            setLoading(false);
        }
    }, [email]);

    useEffect(() => {
        if (email) fetchData(page, filtro);
    }, [fetchData, email, page, filtro]);

    // Polling para detectar si el QR fue escaneado por el portero
    useEffect(() => {
        let interval;
        if (qrModal.open && qrModal.mov && !qrModal.scanned) {
            interval = setInterval(async () => {
                try {
                    const res = await MovementsService.getStatus(qrModal.mov.id);
                    if (res.data.idEstado === ESTADO_COMPLETADO) {
                        setQrModal(prev => ({ ...prev, scanned: true }));
                        clearInterval(interval);
                        // Refrescar la lista de movimientos
                        fetchData(page, filtro);
                        // Cerrar el modal automáticamente después de un momento
                        setTimeout(() => {
                            setQrModal({ open: false, mov: null, scanned: false });
                        }, 4000); // 4 segundos para que vea el check verde
                    }
                } catch (err) {
                    console.error('Error polling QR status:', err);
                }
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [qrModal.open, qrModal.mov, qrModal.scanned, fetchData, page, filtro]);

    const handleFiltroChange = (nuevoFiltro) => {
        setFiltro(nuevoFiltro);
        setPage(1); // resetear a primera página al cambiar filtro
    };

    const handlePageChange = (newPage) => {
        setPage(newPage);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleApprove = async () => {
        setActionLoading(true);
        try {
            await MovementsService.approve(approveModal.mov.id, email);
            setApproveModal({ open: false, mov: null });
            setActionResult({ type: 'success', message: 'Movimiento aprobado correctamente.' });
            fetchData(page, filtro);
        } catch (err) {
            setActionResult({ type: 'error', message: err.response?.data?.error || 'Error al aprobar el movimiento.' });
        } finally {
            setActionLoading(false);
        }
    };

    const handleReject = async () => {
        setActionLoading(true);
        try {
            await MovementsService.reject(rejectModal.mov.id, email, rejectModal.observacion);
            setRejectModal({ open: false, mov: null, observacion: '' });
            setActionResult({ type: 'success', message: 'Movimiento rechazado.' });
            fetchData(page, filtro);
        } catch (err) {
            setActionResult({ type: 'error', message: err.response?.data?.error || 'Error al rechazar el movimiento.' });
        } finally {
            setActionLoading(false);
        }
    };

    const handleCancel = async () => {
        setActionLoading(true);
        try {
            await MovementsService.cancel(cancelModal.mov.id, email, cancelModal.observacion);
            setCancelModal({ open: false, mov: null, observacion: '' });
            setActionResult({ type: 'success', message: 'Movimiento anulado correctamente.' });
            fetchData(page, filtro);
        } catch (err) {
            setActionResult({ type: 'error', message: err.response?.data?.error || 'Error al anular el movimiento.' });
        } finally {
            setActionLoading(false);
        }
    };

    const pendingActionCount = data.pendingActionCount || 0;

    const filtros = [
        { key: 'todos', label: 'Todos' },
        ...(data.esAutorizador ? [{ key: 'accion', label: `Requieren acción${pendingActionCount > 0 ? ` (${pendingActionCount})` : ''}` }] : []),
        { key: 'solicitado', label: 'Solicitados' },
        { key: 'pendiente', label: 'Pendientes' },
        { key: 'completado', label: 'Completados' },
        { key: 'rechazado', label: 'Rechazados' },
        { key: 'anulado', label: 'Anulados' },
    ];

    return (
        <div className="mis-solicitudes card-anim" style={{ maxWidth: '900px', margin: '0 auto' }}>
            <header style={{ marginBottom: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                        <h1 style={{ fontSize: '2.2rem', fontWeight: '900', color: 'var(--primary)' }}>
                            Mis Solicitudes<span style={{ color: 'var(--dy-red)' }}>.</span>
                        </h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginTop: '4px' }}>
                            {data.esAutorizador
                                ? 'Gestionás tus solicitudes y las que requieren tu autorización.'
                                : 'Seguí el estado de tus solicitudes de movimiento.'}
                        </p>
                    </div>
                    <Button variant="secondary" size="sm" type="button"
                        onClick={() => fetchData(page, filtro)} disabled={loading}>
                        <RefreshCw size={16} /> Actualizar
                    </Button>
                </div>

                {data.esAutorizador && pendingActionCount > 0 && (
                    <div className="mis-solicitudes__alert">
                        <AlertCircle size={18} />
                        <span>Tenés <strong>{pendingActionCount}</strong> solicitud{pendingActionCount > 1 ? 'es' : ''} esperando tu autorización.</span>
                    </div>
                )}
            </header>

            {error && (
                <div className="mis-solicitudes__error glass">
                    <XCircle size={20} /> {error}
                </div>
            )}

            {actionResult && (
                <div className={`mis-solicitudes__alert ${actionResult.type === 'error' ? 'mis-solicitudes__alert--error' : ''}`}
                    style={{ marginBottom: '16px' }}>
                    {actionResult.type === 'success' ? <CheckCircle size={18} /> : <XCircle size={18} />}
                    <span>{actionResult.message}</span>
                    <button onClick={() => setActionResult(null)}
                        style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Filtros */}
            <div className="mis-solicitudes__filtros">
                {filtros.map(f => (
                    <button
                        key={f.key}
                        className={`mis-solicitudes__filtro-btn ${filtro === f.key ? 'active' : ''}`}
                        onClick={() => handleFiltroChange(f.key)}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Lista */}
            {loading ? (
                <div className="mis-solicitudes__empty glass">
                    <svg className="spinner" viewBox="0 0 50 50" style={{ width: '36px', height: '36px', opacity: 0.5 }}>
                        <circle className="path" cx="25" cy="25" r="20" fill="none" strokeWidth="5"></circle>
                    </svg>
                    <p>Cargando...</p>
                </div>
            ) : data.movements.length === 0 ? (
                <div className="mis-solicitudes__empty glass">
                    <Clock size={40} style={{ opacity: 0.3 }} />
                    <p>No hay solicitudes en esta categoría.</p>
                </div>
            ) : (
                <>
                    <div className="mis-solicitudes__lista">
                        {data.movements.map(mov => (
                            <MovimientoCard
                                key={mov.id}
                                mov={mov}
                                esAutorizador={data.esAutorizador}
                                currentUserEmail={email}
                                onApprove={(m) => setApproveModal({ open: true, mov: m })}
                                onReject={(m) => setRejectModal({ open: true, mov: m, observacion: '' })}
                                onCancel={(m) => setCancelModal({ open: true, mov: m, observacion: '' })}
                                onShowQR={(m) => setQrModal({ open: true, mov: m })}
                            />
                        ))}
                    </div>

                    <Pagination
                        pagination={data.pagination}
                        onPageChange={handlePageChange}
                    />
                </>
            )}

            {/* Modal Aprobar */}
            <Modal
                isOpen={approveModal.open}
                onClose={() => !actionLoading && setApproveModal({ open: false, mov: null })}
                title="Aprobar movimiento"
                type="success"
                message={
                    <div>
                        <p>¿Confirmás la aprobación del movimiento <strong>#{approveModal.mov?.id}</strong>?</p>
                        <p style={{ marginTop: '8px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                            El movimiento pasará al estado <strong>Pendiente</strong> y podrá ser ejecutado por el personal de seguridad.
                        </p>
                        {approveModal.mov?.conRegreso === 1 && (
                            <p style={{ marginTop: '8px', color: '#818cf8', fontSize: '0.85rem', fontWeight: '500' }}>
                                🔗 Al tratarse de un movimiento con retorno, se generará automáticamente la serie completa de movimientos encadenados, todos en estado Pendiente.
                            </p>
                        )}
                    </div>
                }
                confirmLabel={actionLoading ? 'Aprobando...' : 'Confirmar'}
                cancelLabel="Cancelar"
                onConfirm={handleApprove}
                onCancel={() => setApproveModal({ open: false, mov: null })}
            />

            {/* Modal Rechazar */}
            <Modal
                isOpen={rejectModal.open}
                onClose={() => !actionLoading && setRejectModal({ open: false, mov: null, observacion: '' })}
                title="Rechazar movimiento"
                type="error"
                message={
                    <div>
                        <p>¿Confirmás el rechazo del movimiento <strong>#{rejectModal.mov?.id}</strong>?</p>
                        <div style={{ marginTop: '16px' }}>
                            <label style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: '500', display: 'block', marginBottom: '8px' }}>
                                Motivo del rechazo (opcional)
                            </label>
                            <textarea
                                value={rejectModal.observacion}
                                onChange={(e) => setRejectModal(prev => ({ ...prev, observacion: e.target.value }))}
                                placeholder="Ingresá el motivo del rechazo..."
                                maxLength={300}
                                style={{
                                    width: '100%', minHeight: '80px', padding: '10px',
                                    backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
                                    borderRadius: 'var(--radius)', color: 'var(--text)',
                                    fontSize: '0.9rem', resize: 'vertical', outline: 'none'
                                }}
                            />
                        </div>
                    </div>
                }
                confirmLabel={actionLoading ? 'Rechazando...' : 'Rechazar'}
                cancelLabel="Cancelar"
                onConfirm={handleReject}
                onCancel={() => setRejectModal({ open: false, mov: null, observacion: '' })}
            />

            {/* Modal Anular */}
            <Modal
                isOpen={cancelModal.open}
                onClose={() => !actionLoading && setCancelModal({ open: false, mov: null, observacion: '' })}
                title="Anular movimiento"
                type="error"
                message={
                    <div>
                        <p>¿Confirmás la anulación del movimiento <strong>#{cancelModal.mov?.id}</strong>?</p>
                        <p style={{ marginTop: '8px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                            Esta acción dejará el movimiento en estado <strong>Anulado</strong>. No podrá revertirse.
                        </p>
                        {(cancelModal.mov?.grupo_total || 0) > 1 && (
                            <p style={{ marginTop: '8px', color: '#818cf8', fontSize: '0.85rem', fontWeight: '500' }}>
                                🔗 Este movimiento forma parte de una serie de {cancelModal.mov.grupo_total} pasos. Todos los pasos activos de la serie serán anulados.
                            </p>
                        )}
                        <div style={{ marginTop: '16px' }}>
                            <label style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: '500', display: 'block', marginBottom: '8px' }}>
                                Motivo de anulación (opcional)
                            </label>
                            <textarea
                                value={cancelModal.observacion}
                                onChange={(e) => setCancelModal(prev => ({ ...prev, observacion: e.target.value }))}
                                placeholder="Ingresá el motivo de la anulación..."
                                maxLength={300}
                                style={{
                                    width: '100%', minHeight: '80px', padding: '10px',
                                    backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
                                    borderRadius: 'var(--radius)', color: 'var(--text)',
                                    fontSize: '0.9rem', resize: 'vertical', outline: 'none'
                                }}
                            />
                        </div>
                    </div>
                }
                confirmLabel={actionLoading ? 'Anulando...' : 'Anular'}
                cancelLabel="Cancelar"
                onConfirm={handleCancel}
                onCancel={() => setCancelModal({ open: false, mov: null, observacion: '' })}
            />

            {/* Modal QR */}
            <Modal
                isOpen={qrModal.open}
                onClose={() => setQrModal({ open: false, mov: null })}
                title={qrModal.scanned ? "¡Éxito!" : "Autorización QR"}
                message={
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '0' }}>
                        {qrModal.scanned ? (
                            <div style={{ padding: '20px 0', textAlign: 'center', animation: 'modalScaleUp 0.4s ease-out' }}>
                                <div style={{ 
                                    width: '100px', height: '100px', borderRadius: '50%', 
                                    background: 'rgba(34, 197, 94, 0.12)', color: '#22c55e',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    margin: '0 auto 20px',
                                    boxShadow: '0 0 20px rgba(34, 197, 94, 0.2)'
                                }}>
                                    <Check size={60} strokeWidth={3} />
                                </div>
                                <p style={{ fontWeight: '900', fontSize: '1.6rem', color: '#22c55e', marginBottom: '8px' }}>Ingreso Autorizado</p>
                                <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)' }}>Tu solicitud ha sido completada correctamente.</p>
                            </div>
                        ) : (
                            <>
                                <div style={{ background: 'white', padding: '16px', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.15)' }}>
                                    <QRCodeSVG
                                        value={qrModal.mov ? generateQRData(qrModal.mov.id) : ''}
                                        size={200}
                                        level="H"
                                        includeMargin={true}
                                    />
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <p style={{ fontWeight: '800', fontSize: '1.4rem', marginBottom: '2px', color: 'var(--primary)' }}>
                                        {qrModal.mov?.persona_interna_nombre || qrModal.mov?.idPersonaExterna}
                                    </p>
                                    <p style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>Muestre este código en portería</p>
                                </div>
                            </>
                        )}
                    </div>
                }
                confirmLabel={qrModal.scanned ? "Entendido" : "Cerrar"}
                showCancel={false}
            />
        </div>
    );
};

export default MisSolicitudes;
