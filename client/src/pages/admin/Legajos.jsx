import React, { useState, useEffect } from 'react';
import { MastersService } from '../../services/api';
import {
    Search, Plus, Edit2, Trash2, X, Check,
    ShieldAlert, Star, User, ShieldCheck, AlertCircle
} from 'lucide-react';
import { Button } from '../../components/Button';
import Modal from '../../components/Modal';

const Legajos = () => {
    const [legajos, setLegajos] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);

    // Pagination state
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ totalPages: 1, total: 0 });

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'
    const [selectedLegajo, setSelectedLegajo] = useState(null);
    const [formData, setFormData] = useState({
        legajo: '',
        apellido_nombre: '',
        email: '',
        idRol: 1,
        esAutorizador: false,
        estado: 1
    });
    const [formLoading, setFormLoading] = useState(false);
    const [formErrors, setFormErrors] = useState({});

    // Delete Confirmation state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [legajoToDelete, setLegajoToDelete] = useState(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchLegajos(page, searchTerm);
        }, 300); // Pequeño debounce para no saturar al escribir
        return () => clearTimeout(timer);
    }, [page, searchTerm]);

    const fetchLegajos = async (p = 1, s = '') => {
        setLoading(true);
        try {
            const res = await MastersService.getLegajos(p, s);
            setLegajos(res.data.data);
            setPagination(res.data.pagination);
            setError(null);
        } catch (err) {
            console.error('Error fetching legajos:', err);
            setError('No se pudieron cargar los legajos. Verifique la conexión con el servidor.');
        } finally {
            setLoading(false);
        }
    };

    // El filtrado ahora se hace en el servidor, usamos legajos directamente
    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
        setPage(1); // Resetear a la primera página al buscar
    };

    const openAddModal = () => {
        setModalMode('add');
        setFormData({
            legajo: '',
            apellido_nombre: '',
            email: '',
            idRol: 1,
            esAutorizador: false,
            estado: 1
        });
        setFormErrors({});
        setShowModal(true);
    };

    const openEditModal = (legajo) => {
        setModalMode('edit');
        setSelectedLegajo(legajo);
        setFormData({
            legajo: legajo.legajo,
            apellido_nombre: legajo.apellido_nombre,
            email: legajo.email || '',
            idRol: legajo.idRol || 1,
            esAutorizador: legajo.esAutorizador === 1,
            estado: legajo.estado ?? 1
        });
        setFormErrors({});
        setShowModal(true);
    };

    const validateForm = () => {
        const errors = {};
        if (!formData.legajo) errors.legajo = 'El legajo es obligatorio';
        if (!formData.apellido_nombre) errors.apellido_nombre = 'El nombre es obligatorio';
        if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            errors.email = 'El formato de email no es válido';
        }
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;

        setFormLoading(true);
        try {
            if (modalMode === 'add') {
                await MastersService.createLegajo(formData);
                setSuccessMsg('Legajo creado correctamente');
            } else {
                await MastersService.updateLegajo(selectedLegajo.id, formData);
                setSuccessMsg('Legajo actualizado correctamente');
            }
            setShowModal(false);
            fetchLegajos(page, searchTerm);
            setTimeout(() => setSuccessMsg(null), 3000);
        } catch (err) {
            console.error('Error saving legajo:', err);
            const msg = err.response?.data?.error || 'Error al guardar el legajo';
            setFormErrors({ server: msg });
        } finally {
            setFormLoading(false);
        }
    };

    const confirmDelete = (legajo) => {
        setLegajoToDelete(legajo);
        setShowDeleteModal(true);
    };

    const handleDelete = async () => {
        setFormLoading(true);
        try {
            await MastersService.deleteLegajo(legajoToDelete.id);
            setSuccessMsg('Legajo eliminado correctamente');
            setShowDeleteModal(false);
            fetchLegajos(page, searchTerm);
            setTimeout(() => setSuccessMsg(null), 3000);
        } catch (err) {
            console.error('Error deleting legajo:', err);
            alert(err.response?.data?.error || 'Error al eliminar el legajo');
        } finally {
            setFormLoading(false);
        }
    };

    const getRoleInfo = (idRol) => {
        switch (idRol) {
            case 100: return { label: 'Sysadmin', color: '#ef4444', bgColor: '#fee2e2', icon: <ShieldAlert size={14} /> };
            case 2: return { label: 'RRHH', color: '#d97706', bgColor: '#fef3c7', icon: <Star size={14} /> };
            default: return { label: 'Usuario', color: '#4b5563', bgColor: '#f3f4f6', icon: <User size={14} /> };
        }
    };

    return (
        <div className="admin-page card-anim">
            <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--primary)' }}>
                        Gestión de Legajos<span style={{ color: 'var(--dy-red)' }}>.</span>
                    </h1>
                    <p style={{ color: 'var(--text-muted)' }}>Administración completa del personal y permisos.</p>
                </div>
                <Button onClick={openAddModal} className="btn-add">
                    <Plus size={18} /> Nuevo Legajo
                </Button>
            </header>

            {successMsg && (
                <div className="alert-success glass">
                    <Check size={18} /> {successMsg}
                </div>
            )}

            <div className="search-bar-container glass" style={{ marginBottom: '20px', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '12px', borderRadius: '15px' }}>
                <Search size={20} color="var(--text-muted)" />
                <input
                    type="text"
                    placeholder="Buscar por nombre, legajo o email..."
                    value={searchTerm}
                    onChange={handleSearchChange}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text)', width: '100%', outline: 'none', fontSize: '1rem' }}
                />
            </div>

            <div className="table-container glass">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>Legajo</th>
                            <th>Apellido y Nombre</th>
                            <th>Email</th>
                            <th>Rol</th>
                            <th style={{ textAlign: 'center' }}>Autorizante</th>
                            <th style={{ textAlign: 'center' }}>Estado</th>
                            <th style={{ textAlign: 'right' }}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="6" style={{ textAlign: 'center', padding: '40px' }}>Cargando datos...</td></tr>
                        ) : legajos.length === 0 ? (
                            <tr><td colSpan="6" style={{ textAlign: 'center', padding: '40px' }}>No se encontraron resultados.</td></tr>
                        ) : (
                            legajos.map(l => {
                                const role = getRoleInfo(l.idRol);
                                return (
                                    <tr key={l.id}>
                                        <td style={{ fontWeight: 700, color: 'var(--dy-red)' }}>#{l.legajo}</td>
                                        <td>{l.apellido_nombre}</td>
                                        <td style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{l.email || '-'}</td>
                                        <td>
                                            <span style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                padding: '4px 10px', borderRadius: '20px',
                                                fontSize: '0.75rem', fontWeight: 700,
                                                backgroundColor: role.bgColor, color: role.color
                                            }}>
                                                {role.icon} {role.label}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            {l.esAutorizador === 1 ? (
                                                <ShieldCheck size={20} color="#059669" style={{ margin: '0 auto' }} />
                                            ) : (
                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No</span>
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span className={`status-badge ${l.estado === 1 ? 'active' : 'inactive'}`}>
                                                {l.estado === 1 ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                                <button onClick={() => openEditModal(l)} className="btn-action edit" title="Editar">
                                                    <Edit2 size={16} />
                                                </button>
                                                <button onClick={() => confirmDelete(l)} className="btn-action delete" title="Eliminar">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>

                {/* Pagination Controls */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '20px',
                    borderTop: '1px solid var(--border)',
                    background: 'rgba(255,255,255,0.02)'
                }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        Mostrando {legajos.length} de {pagination.total} legajos
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <Button
                            variant="secondary"
                            size="sm"
                            disabled={page <= 1 || loading}
                            onClick={() => setPage(p => p - 1)}
                        >
                            Anterior
                        </Button>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '0 10px' }}>
                            <span style={{ fontWeight: 700 }}>{page}</span>
                            <span style={{ color: 'var(--text-muted)' }}>/ {pagination.totalPages}</span>
                        </div>
                        <Button
                            variant="secondary"
                            size="sm"
                            disabled={page >= pagination.totalPages || loading}
                            onClick={() => setPage(p => p + 1)}
                        >
                            Siguiente
                        </Button>
                    </div>
                </div>
            </div>

            {/* Modal de Alta/Edición */}
            <Modal
                isOpen={showModal}
                onClose={() => !formLoading && setShowModal(false)}
                title={modalMode === 'add' ? 'Nuevo Legajo' : 'Editar Legajo'}
                maxWidth="900px"
            >
                <form onSubmit={handleSave} className="legajo-form" style={{ padding: '10px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                        <div className="form-group">
                            <label>Número de Legajo</label>
                            <input
                                type="text"
                                value={formData.legajo}
                                onChange={e => setFormData({ ...formData, legajo: e.target.value })}
                                placeholder="Ej: 4501"
                                className={formErrors.legajo ? 'error' : ''}
                                disabled={formLoading}
                            />
                            {formErrors.legajo && <span className="error-text">{formErrors.legajo}</span>}
                        </div>

                        <div className="form-group">
                            <label>Apellido y Nombre</label>
                            <input
                                type="text"
                                value={formData.apellido_nombre}
                                onChange={e => setFormData({ ...formData, apellido_nombre: e.target.value })}
                                placeholder="Ej: Gonzalez Pedro"
                                className={formErrors.apellido_nombre ? 'error' : ''}
                                disabled={formLoading}
                            />
                            {formErrors.apellido_nombre && <span className="error-text">{formErrors.apellido_nombre}</span>}
                        </div>

                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <label>Email Institucional</label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                                placeholder="ejemplo@donyeyo.com.ar"
                                className={formErrors.email ? 'error' : ''}
                                disabled={formLoading}
                            />
                            {formErrors.email && <span className="error-text">{formErrors.email}</span>}
                        </div>

                        <div className="form-group">
                            <label>Rol asignado</label>
                            <select
                                value={formData.idRol}
                                onChange={e => {
                                    const val = parseInt(e.target.value);
                                    setFormData({
                                        ...formData,
                                        idRol: val,
                                        // Auto-marcar autorizante si es RRHH o Admin
                                        esAutorizador: (val === 2 || val === 100) ? true : formData.esAutorizador
                                    });
                                }}
                                disabled={formLoading}
                            >
                                <option value={1}>Usuario Estándar</option>
                                <option value={2}>RRHH / Gestión</option>
                                <option value={100}>Administrador (Sysadmin)</option>
                            </select>
                        </div>

                        <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '25px' }}>
                            <input
                                type="checkbox"
                                id="checkAuth"
                                checked={formData.esAutorizador}
                                onChange={e => setFormData({ ...formData, esAutorizador: e.target.checked })}
                                // Bloquear si es admin/rrhh pues deben serlo
                                disabled={formLoading || formData.idRol === 2 || formData.idRol === 100}
                                style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                            />
                            <label htmlFor="checkAuth" style={{ cursor: 'pointer', margin: 0 }}>¿Es autorizante?</label>
                        </div>

                        <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '25px' }}>
                            <div 
                                onClick={() => !formLoading && setFormData({ ...formData, estado: formData.estado === 1 ? 0 : 1 })}
                                className={`custom-switch ${formData.estado === 1 ? 'active' : ''}`}
                                style={{
                                    width: '40px', height: '22px', borderRadius: '20px',
                                    backgroundColor: formData.estado === 1 ? 'var(--dy-red)' : '#d1d5db',
                                    position: 'relative', cursor: formLoading ? 'not-allowed' : 'pointer',
                                    transition: '0.3s'
                                }}
                            >
                                <div style={{
                                    width: '18px', height: '18px', borderRadius: '50%',
                                    backgroundColor: 'white', position: 'absolute', top: '2px',
                                    left: formData.estado === 1 ? '20px' : '2px', transition: '0.3s'
                                }} />
                            </div>
                            <label style={{ cursor: 'pointer', margin: 0, fontWeight: 700 }}>
                                {formData.estado === 1 ? 'Personal Activo' : 'Personal Inactivo'}
                            </label>
                        </div>
                    </div>

                    {formErrors.server && (
                        <div className="error-alert">
                            <AlertCircle size={18} /> {formErrors.server}
                        </div>
                    )}

                    <div className="form-actions">
                        <Button variant="ghost" type="button" onClick={() => setShowModal(false)} disabled={formLoading}>
                            Cancelar
                        </Button>
                        <Button variant="primary" type="submit" loading={formLoading}>
                            {modalMode === 'add' ? 'Crear Legajo' : 'Guardar Cambios'}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Modal de Confirmación de Eliminación */}
            <Modal
                isOpen={showDeleteModal}
                onClose={() => !formLoading && setShowDeleteModal(false)}
                title="Confirmar Eliminación"
            >
                <div style={{ textAlign: 'center', padding: '10px 0' }}>
                    <div style={{ color: 'var(--error)', marginBottom: '15px' }}>
                        <AlertCircle size={48} style={{ margin: '0 auto' }} />
                    </div>
                    <p>¿Estás seguro que deseas eliminar el legajo?</p>
                    <p style={{ fontWeight: 700, fontSize: '1.2rem', margin: '10px 0' }}>
                        #{legajoToDelete?.legajo} - {legajoToDelete?.apellido_nombre}
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        Esta acción no se puede deshacer y puede fallar si el usuario tiene autorizaciones registradas.
                    </p>
                </div>
                <div className="form-actions" style={{ marginTop: '20px' }}>
                    <Button variant="ghost" type="button" onClick={() => setShowDeleteModal(false)} disabled={formLoading}>
                        No, cancelar
                    </Button>
                    <Button variant="primary" onClick={handleDelete} loading={formLoading} style={{ backgroundColor: 'var(--error)' }}>
                        Sí, eliminar
                    </Button>
                </div>
            </Modal>

            <style dangerouslySetInnerHTML={{
                __html: `
                .admin-table { width: 100%; border-collapse: collapse; min-width: 650px; }
                .admin-table th { text-align: left; padding: 15px; border-bottom: 2px solid var(--border); font-size: 0.85rem; text-transform: uppercase; color: var(--text-muted); white-space: nowrap; }
                .admin-table td { padding: 15px; border-bottom: 1px solid var(--border); font-size: 0.95rem; }
                .admin-table tr:last-child td { border-bottom: none; }
                .admin-table tr:hover { background: rgba(0,0,0,0.02); }
                
                .table-container { border-radius: 20px; margin-top: 20px; width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; background: var(--surface); box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05); }
                
                .btn-action { padding: 8px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); color: var(--text); cursor: pointer; transition: all 0.2s; }
                .btn-action.edit:hover { color: var(--dy-red); border-color: var(--dy-red); background: #fff1f2; }
                .btn-action.delete:hover { color: #ef4444; border-color: #fecaca; background: #fff1f2; }
                
                .status-badge { padding: 4px 12px; borderRadius: 20px; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; }
                .status-badge.active { background: #d1fae5; color: #065f46; border: 1px solid #10b981; }
                .status-badge.inactive { background: #f3f4f6; color: #4b5563; border: 1px solid #9ca3af; }

                .alert-success { background: #d1fae5; color: #065f46; padding: 12px 20px; border-radius: 12px; margin-bottom: 20px; display: flex; align-items: center; gap: 10px; font-weight: 600; border: 1px solid #a7f3d0; }
                
                .legajo-form { padding: 10px 0; }
                .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
                .form-group { display: flex; flex-direction: column; gap: 8px; }
                .form-group label { font-size: 0.9rem; font-weight: 600; color: var(--text-muted); }
                .form-group input, .form-group select { padding: 12px; border-radius: 12px; border: 1px solid var(--border); background: var(--surface); color: var(--text); outline: none; transition: 0.2s; }
                .form-group input:focus { border-color: var(--dy-red); box-shadow: 0 0 0 3px rgba(228, 5, 33, 0.1); }
                .form-group input.error { border-color: var(--error); }
                
                .error-text { color: var(--error); font-size: 0.8rem; font-weight: 600; }
                .error-alert { background: #fee2e2; color: #b91c1c; padding: 12px; border-radius: 10px; margin-bottom: 20px; display: flex; align-items: center; gap: 8px; font-size: 0.9rem; }
                
                .form-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 30px; }
                
                @media (max-width: 768px) {
                    .form-grid { grid-template-columns: 1fr; }
                    .admin-table th:nth-child(3), .admin-table td:nth-child(3) { display: none; }
                }
            `}} />
        </div>
    );
};

export default Legajos;
