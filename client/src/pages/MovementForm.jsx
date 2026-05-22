import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MastersService, MovementsService } from '../services/api';
import { Card, Input, Select, Autocomplete, Switch, DatePicker, Textarea } from '../components/FormElements';
import { Button } from '../components/Button';
import Modal from '../components/Modal';
import { Plus, Trash2, Send, AlertTriangle } from 'lucide-react';

import { useAuth } from "../config/AuthContext";

const MovementForm = () => {
    const { user, hasRole, legajoInfo } = useAuth();
    const navigate = useNavigate();
    const currentUser = user || {};

    const today = new Date().toLocaleDateString('en-CA');
    const maxDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA');

    const [legajos, setLegajos] = useState([]);
    const [autorizadores, setAutorizadores] = useState([]); // solo los que tienen esAutorizador=1
    const [lugares, setLugares] = useState([]);
    const [types, setTypes] = useState([]);
    const [myLegajo, setMyLegajo] = useState(null);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [showSelfAuthWarning, setShowSelfAuthWarning] = useState(false);
    const [showDuplicateModal, setShowDuplicateModal] = useState(false);
    const [duplicateModalMessage, setDuplicateModalMessage] = useState('');
    const [isVerifyingLegajo, setIsVerifyingLegajo] = useState(true);
    const [isLoadingMasters, setIsLoadingMasters] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const capitalizeName = (str) => {
        if (!str) return '';
        return str.split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    };

    const getSavedValue = (key, defaultValue) => {
        return localStorage.getItem(`movementForm_${key}`) || defaultValue;
    };

    const dropdownKeys = ['idTipo', 'idLugarOrigen', 'idLugarDestino', 'personaAutorizante'];

    const [formData, setFormData] = useState({
        movement: {
            idTipo: getSavedValue('idTipo', '1'),
            personaInterna: '', // Siempre vacío al cargar
            fechaHoraRegistro: new Date().toLocaleDateString('en-CA'), // Solo fecha para el input
            idLugarOrigen: getSavedValue('idLugarOrigen', ''),
            idLugarDestino: getSavedValue('idLugarDestino', ''),
            motivo: '',
            personaAutorizante: getSavedValue('personaAutorizante', ''),
            observacion: '',
            destinoDetalle: '',
            conRegreso: true,
            esRecurrente: false,
            vencimientoRecurrencias: '',
            usuario_app: currentUser.username || currentUser.email || 'anonymous'
        },
        articles: [],
        documents: []
    });

    const [authModalType, setAuthModalType] = useState('not_found'); // 'not_found' | 'server_error'

    useEffect(() => {
        const fetchData = async () => {
            setIsLoadingMasters(true);
            try {
                // Verify current user legajo (priorizar el del contexto si existe, especialmente útil para MOCK)
                if (legajoInfo) {
                    setMyLegajo(legajoInfo);
                    const isPrivileged = legajoInfo.esAutorizador === 1 || legajoInfo.idRol >= 2;
                    setFormData(prev => ({
                        ...prev,
                        movement: {
                            ...prev.movement,
                            personaInterna: isPrivileged ? '' : legajoInfo.legajo
                        }
                    }));
                    setIsVerifyingLegajo(false);
                } else if (currentUser.username || currentUser.email) {
                    try {
                        const meRes = await MastersService.getMe(currentUser.username || currentUser.email);
                        setMyLegajo(meRes.data);
                        const isPrivileged = meRes.data.esAutorizador === 1 || meRes.data.idRol >= 2;
                        setFormData(prev => ({
                            ...prev,
                            movement: {
                                ...prev.movement,
                                personaInterna: isPrivileged ? '' : meRes.data.legajo
                            }
                        }));
                    } catch (err) {
                        console.error('User legajo lookup error:', err);
                        const status = err.response?.status;
                        if (status === 429) {
                            setAuthModalType('rate_limit');
                        } else if (status === 404) {
                            setAuthModalType('not_found');
                        } else {
                            setAuthModalType('server_error');
                        }
                        setShowAuthModal(true);
                    } finally {
                        setIsVerifyingLegajo(false);
                    }
                } else {
                    setAuthModalType('not_found');
                    setShowAuthModal(true);
                    setIsVerifyingLegajo(false);
                }

                const [l, lug, t] = await Promise.all([
                    MastersService.getLegajos(1, '', 5000, true), // Traer solo legajos activos para el formulario
                    MastersService.getLugares(),
                    MastersService.getMovementTypes()
                ]);

                // Normalizar nombres de legajos (Capitalize)
                // AXIOS resp.data => { data: [], pagination: {} }
                const legajosArray = l.data.data || (Array.isArray(l.data) ? l.data : []);

                const normalizedLegajos = legajosArray.map(item => ({
                    ...item,
                    apellido_nombre: capitalizeName(item.apellido_nombre)
                }));

                console.log('DEBUG: Legajos fetched for form:', normalizedLegajos.length);
                const testLegajo = normalizedLegajos.find(l => String(l.legajo) === '1137');
                if (testLegajo) console.log('DEBUG: Found legajo 1137 in form list! Estado:', testLegajo.estado);

                setLegajos(normalizedLegajos);
                // Autorizadores: los que tienen esAutorizador = 1
                setAutorizadores(normalizedLegajos.filter(l => l.esAutorizador === 1));
                setLugares(lug.data);
                const movementTypes = t.data;
                setTypes(movementTypes);

                // Asignar valores por defecto si están vacíos después de cargar los datos
                setFormData(prev => {
                    const newMov = { ...prev.movement };
                    let changed = false;



                    // 2. Origen (según el tipo actual)
                    if (!newMov.idLugarOrigen && lug.data.length > 0) {
                        const currentType = movementTypes.find(type => String(type.id) === String(newMov.idTipo));
                        const validOrigen = lug.data.find(l => {
                            if (currentType?.direccion === 'saliente' && l.nombre.toLowerCase() === 'exteriores') return false;
                            return true;
                        });
                        if (validOrigen) {
                            newMov.idLugarOrigen = String(validOrigen.id);
                            changed = true;
                        }
                    }

                    // 3. Destino (distinto al origen)
                    if (!newMov.idLugarDestino && lug.data.length > 0) {
                        const origin = newMov.idLugarOrigen;
                        const validDest = lug.data.find(l => String(l.id) !== String(origin));
                        if (validDest) {
                            newMov.idLugarDestino = String(validDest.id);
                            changed = true;
                        }
                    }

                    if (changed) {
                        return { ...prev, movement: newMov };
                    }
                    return prev;
                });
            } catch (error) {
                console.error('Error fetching masters:', error);
            } finally {
                setIsLoadingMasters(false);
            }
        };
        fetchData();
    }, []);

    const handleMovChange = (e) => {
        const { name, value, type, checked } = e.target;
        const val = type === 'checkbox' ? checked : value;

        setFormData(prev => {
            const nextMov = { ...prev.movement, [name]: val };

            // Si desactiva recurrencia, limpiar fecha de vencimiento
            if (name === 'esRecurrente' && !val) {
                nextMov.vencimientoRecurrencias = '';
            }

            return {
                ...prev,
                movement: nextMov
            };
        });
    };

    const addArticle = () => {
        setFormData(prev => ({
            ...prev,
            articles: [...prev.articles, {
                descripcion: '',
                cantidad: 1,
                idEstado: 1,
                conRetorno: true,
                presentacion: 'Bulto(s)',
                idLugarDestino: prev.movement.idLugarDestino,
                destinatario: ''
            }]
        }));
    };

    const removeArticle = (index) => {
        setFormData(prev => ({
            ...prev,
            articles: prev.articles.filter((_, i) => i !== index)
        }));
    };

    const handleArticleChange = (index, e) => {
        const { name, value, type, checked } = e.target;
        const newArticles = [...formData.articles];
        newArticles[index] = { ...newArticles[index], [name]: type === 'checkbox' ? checked : value };
        setFormData(prev => ({ ...prev, articles: newArticles }));
    };

    const addDocument = () => {
        setFormData(prev => ({
            ...prev,
            documents: [...prev.documents, {
                tipo: 'Remito',
                descripcion: '',
                cantidad: 1,
                conRetorno: true,
                idLugarDestino: prev.movement.idLugarDestino,
                destinatario: ''
            }]
        }));
    };

    const removeDocument = (index) => {
        setFormData(prev => ({
            ...prev,
            documents: prev.documents.filter((_, i) => i !== index)
        }));
    };

    const handleDocumentChange = (index, e) => {
        const { name, value, type, checked } = e.target;
        const newDocs = [...formData.documents];
        newDocs[index] = { ...newDocs[index], [name]: type === 'checkbox' ? checked : value };
        setFormData(prev => ({ ...prev, documents: newDocs }));
    };

    // Determinar si el usuario logueado NO es autorizador => debe seleccionar uno
    const userIsAutorizador = myLegajo?.esAutorizador === 1;

    const validateAndScroll = () => {
        const errors = [];

        // Validar en orden de arriba hacia abajo en el formulario
        if (!formData.movement.idLugarOrigen) errors.push('field-lugar-origen');
        if (!formData.movement.idLugarDestino) errors.push('field-lugar-destino');

        // Detalle del destino opcional/requerido
        const destinoLugar = lugares.find(l => String(l.id) === String(formData.movement.idLugarDestino));
        if (destinoLugar?.esDependencia === 0 && !formData.movement.destinoDetalle) {
            errors.push('field-destino-detalle');
        }

        if (!formData.movement.idTipo) errors.push('field-tipo');
        if (!formData.movement.motivo) errors.push('field-motivo');
        if (!formData.movement.fechaHoraRegistro) errors.push('field-fecha');
        if (!formData.movement.personaInterna) errors.push('field-persona-interna');

        // Validar autorizante si no es autorizador
        if (!userIsAutorizador && !formData.movement.personaAutorizante) {
            errors.push('field-persona-autorizante');
        }

        // Si hay errores, hacer scroll al primero
        if (errors.length > 0) {
            const firstErrorId = errors[0];
            const element = document.getElementById(firstErrorId);
            if (element) {
                const headerOffset = 220;
                const elementPosition = element.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });

                const input = element.querySelector('input, select, button');
                if (input) {
                    setTimeout(() => input.focus({ preventScroll: true }), 600);
                }

                element.style.transition = 'background-color 0.3s';
                element.style.backgroundColor = 'rgba(228, 5, 33, 0.1)';
                setTimeout(() => {
                    element.style.backgroundColor = 'transparent';
                }, 2000);
            }
            return false;
        }
        return true;
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();

        // Validar campos obligatorios y hacer scroll
        if (!validateAndScroll()) return;

        // Check if legajo was found
        if (!myLegajo) {
            setShowAuthModal(true);
            return;
        }

        // Check for self-authorization (solo si es autorizador autorizándose a sí mismo)
        if (userIsAutorizador && String(formData.movement.personaInterna) === String(myLegajo.legajo)) {
            setShowSelfAuthWarning(true);
            return;
        }

        executeSubmit();
    };

    const executeSubmit = async () => {
        setIsSubmitting(true);
        try {
            // Transform conRetorno (UI) back to sinRetorno (API expected)
            const submitData = {
                ...formData,
                articles: formData.articles.map(art => ({
                    ...art,
                    sinRetorno: !art.conRetorno
                })),
                documents: formData.documents.map(doc => ({
                    ...doc,
                    sinRetorno: !doc.conRetorno
                }))
            };

            const res = await MovementsService.create(submitData);

            // Guardar valores en localStorage para persistencia en el próximo formulario
            dropdownKeys.forEach(key => {
                localStorage.setItem(`movementForm_${key}`, formData.movement[key]);
            });

            const isSolicitado = res.data?.estado === 4;

            // Redirect to status page on success
            navigate('/status', {
                state: {
                    success: true,
                    message: res.data?.message || 'Su solicitud ha sido registrada correctamente en el sistema.',
                    movementId: res.data?.id,
                    isSolicitado
                }
            });
        } catch (error) {
            console.error('Error creating movement:', error);
            setIsSubmitting(false);

            if (error.response?.status === 409 || error.response?.data?.error === 'DuplicateMovement') {
                setDuplicateModalMessage(error.response?.data?.message || 'Ya existe una autorización activa para este autorizado en la misma fecha y hora. Por favor, anule la existente antes de generar una nueva.');
                setShowDuplicateModal(true);
                return;
            }

            let errorMessage = error.message;

            if (error.response?.data) {
                const data = error.response.data;
                if (data.details && Array.isArray(data.details) && data.details.length > 0) {
                    errorMessage = data.details[0].message || data.details[0];
                } else if (data.error && data.error !== 'Validation failed') {
                    errorMessage = data.error;
                }
            }

            navigate('/status', {
                state: {
                    success: false,
                    message: errorMessage
                }
            });
        }
    };

    if (isVerifyingLegajo || isLoadingMasters) {
        return (
            <div className="full-screen-loader">
                <svg className="spinner" viewBox="0 0 50 50" style={{ width: '50px', height: '50px' }}>
                    <circle className="path" cx="25" cy="25" r="20" fill="none" strokeWidth="5"></circle>
                </svg>
                <p>{isVerifyingLegajo ? 'Verificando credenciales...' : 'Cargando datos maestros...'}</p>
            </div>
        );
    }

    return (
        <div className="card-anim" style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <header style={{ marginBottom: '32px' }}>
                <h1 style={{ fontSize: '2.4rem', fontWeight: '900', color: 'var(--primary)' }}>
                    Nueva Solicitud<span style={{ color: 'var(--dy-red)' }}>.</span>
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
                    {userIsAutorizador
                        ? 'Complete los datos para autorizar un ingreso o egreso.'
                        : 'Complete los datos para solicitar autorización para un ingreso o egreso.'}
                </p>
            </header>

            <form onSubmit={handleSubmit}>
                <Card style={{ position: 'relative', zIndex: 10 }}>
                    <h2 style={{ fontSize: '1.25rem', marginBottom: '20px' }}>Detalles del movimiento</h2>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                        {import.meta.env.VITE_PERMITIR_AUTORIZACIONES_DE_INGRESOS !== 'false' && (
                            <Select
                                label="Tipo de movimiento"
                                name="idTipo"
                                containerId="field-tipo"
                                value={String(formData.movement.idTipo)}
                                onChange={handleMovChange}
                                options={types && types.length > 0 ? types.map(t => ({ id: String(t.id), label: t.nombre })) : [{ id: '1', label: 'Egreso de personal' }]}
                                disabled={true}
                                required
                            />
                        )}
                        <Select
                            label="Motivo"
                            name="motivo"
                            containerId="field-motivo"
                            value={formData.movement.motivo}
                            onChange={handleMovChange}
                            options={['Motivos personales', 'Requerimiento laboral', 'Accidente o razones médicas', 'Otros']}
                            required
                            includePlaceholder={true}
                            disabled={isSubmitting}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginTop: '20px' }}>
                        <Switch
                            label="Retorno"
                            name="conRegreso"
                            checked={formData.movement.conRegreso}
                            onChange={handleMovChange}
                            activeLabel="Con retorno al origen - F1"
                            inactiveLabel="Sin retorno al origen - F2"
                            disabled={isSubmitting}
                        />
                        <DatePicker
                            label="Fecha autorizada"
                            name="fechaHoraRegistro"
                            containerId="field-fecha"
                            value={formData.movement.fechaHoraRegistro}
                            onChange={handleMovChange}
                            min={today}
                            max={maxDate}
                            required
                            disabled={isSubmitting}
                        />
                    </div>

                    {(hasRole(2) || userIsAutorizador) && (
                        <div style={{
                            gridColumn: '1 / -1',
                            marginTop: '10px',
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                            gap: '20px',
                            alignItems: 'start'
                        }}>
                            <Switch
                                label="Recurrencia"
                                name="esRecurrente"
                                checked={formData.movement.esRecurrente}
                                onChange={handleMovChange}
                                activeLabel="Se repite diariamente"
                                inactiveLabel="Acción única"
                                disabled={isSubmitting}
                            />

                            <div className="card-anim" style={{ opacity: formData.movement.esRecurrente ? 1 : 0.6, transition: 'opacity 0.2s' }}>
                                <DatePicker
                                    label="Vencimiento de Recurrencia"
                                    name="vencimientoRecurrencias"
                                    value={formData.movement.vencimientoRecurrencias}
                                    onChange={handleMovChange}
                                    min={today}
                                    disabled={!formData.movement.esRecurrente || isSubmitting}
                                />
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                    {formData.movement.esRecurrente
                                        ? "Opcional. Deja vacío para recurrencia indefinida."
                                        : "Activa la recurrencia para establecer un vencimiento."}
                                </p>
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginTop: '20px' }}>
                        <Select
                            label="Lugar de origen"
                            name="idLugarOrigen"
                            containerId="field-lugar-origen"
                            value={formData.movement.idLugarOrigen}
                            onChange={handleMovChange}
                            options={lugares
                                .filter(l => {
                                    const currentType = types.find(t => String(t.id) === String(formData.movement.idTipo));
                                    // Si es saliente, no mostrar Exteriores
                                    if (currentType?.direccion === 'saliente' && l.nombre.toLowerCase() === 'exteriores') return false;
                                    return true;
                                })
                                .map(l => ({ id: l.id, label: l.nombre }))}
                            required
                            includePlaceholder={false}
                            disabled={isSubmitting}
                        />
                        <Select
                            label="Lugar de destino"
                            name="idLugarDestino"
                            containerId="field-lugar-destino"
                            value={formData.movement.idLugarDestino}
                            onChange={handleMovChange}
                            options={lugares
                                .filter(l => String(l.id) !== String(formData.movement.idLugarOrigen)) // No puede ser igual al origen
                                .map(l => ({ id: l.id, label: l.nombre }))}
                            required
                            includePlaceholder={false}
                            disabled={isSubmitting}
                        />
                        <Input
                            label={`Detalle del destino ${lugares.find(l => String(l.id) === String(formData.movement.idLugarDestino))?.esDependencia === 0 ? '' : '(opcional)'}`}
                            name="destinoDetalle"
                            containerId="field-destino-detalle"
                            value={formData.movement.destinoDetalle}
                            onChange={handleMovChange}
                            maxLength={50}
                            required={lugares.find(l => String(l.id) === String(formData.movement.idLugarDestino))?.esDependencia === 0}
                            disabled={isSubmitting}
                        />
                    </div>

                    <div style={{ position: 'relative', zIndex: '1000', marginTop: '20px' }} id="field-persona-interna">
                        {!userIsAutorizador ? (
                            // Usuario no autorizante: campo de solo lectura con su propio nombre
                            <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: '500' }}>Persona a autorizar</label>
                                <input
                                    style={{
                                        width: '100%',
                                        outline: 'none',
                                        opacity: 0.75,
                                        cursor: 'not-allowed',
                                        backgroundColor: 'var(--surface)'
                                    }}
                                    value={legajos.find(l => String(l.legajo) === String(formData.movement.personaInterna))?.apellido_nombre || ''}
                                    readOnly
                                    disabled
                                    tabIndex={-1}
                                />
                            </div>
                        ) : (
                            <Autocomplete
                                label="Persona a autorizar"
                                placeholder="Empiece a escribir apellido..."
                                value={formData.movement.personaInterna}
                                options={legajos.map(l => ({ id: l.legajo, label: l.apellido_nombre }))}
                                onSelect={(opt) => {
                                    setFormData(prev => ({
                                        ...prev,
                                        movement: {
                                            ...prev.movement,
                                            personaInterna: opt.id
                                        }
                                    }));
                                }}
                                required
                                disabled={isSubmitting}
                            />
                        )}
                    </div>

                    {/* Selector de autorizante (solo si el usuario NO es autorizador) */}
                    {!userIsAutorizador && (
                        <div style={{ position: 'relative', zIndex: '999', marginTop: '4px' }}>
                            <Autocomplete
                                label="Autorizante"
                                containerId="field-persona-autorizante"
                                placeholder="Seleccione un autorizante..."
                                value={formData.movement.personaAutorizante}
                                options={autorizadores.map(l => ({ id: l.legajo, label: l.apellido_nombre }))}
                                onSelect={(opt) => {
                                    setFormData(prev => ({
                                        ...prev,
                                        movement: {
                                            ...prev.movement,
                                            personaAutorizante: opt.id
                                        }
                                    }));
                                }}
                                showAll={true} // Mostrar todos los autorizadores (aprox 28) de entrada
                                required
                                disabled={isSubmitting}
                            />
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '-10px', marginBottom: '16px' }}>
                                Su solicitud quedará en estado <strong>Solicitado</strong> hasta que el autorizante la apruebe.
                            </p>
                        </div>
                    )}

                    <div style={{ marginTop: '20px' }}>
                        <Textarea
                            label="Observación (opcional)"
                            name="observacion"
                            value={formData.movement.observacion}
                            onChange={handleMovChange}
                            placeholder="Ingresá notas o detalles adicionales aquí..."
                            maxLength={500}
                            disabled={isSubmitting}
                        />
                    </div>
                </Card>

                <Card>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h2 style={{ fontSize: '1.25rem' }}>Artículos</h2>
                        <Button variant="secondary" size="sm" type="button" onClick={addArticle} disabled={isSubmitting}>
                            <Plus size={16} />
                            <span className="desktop-only">Agregar Artículo</span>
                            <span className="mobile-only">Agregar</span>
                        </Button>
                    </div>
                    {formData.articles.map((art, index) => (
                        <div key={index} style={{
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius)',
                            padding: '20px',
                            paddingTop: '16px',
                            marginBottom: '20px',
                            backgroundColor: 'rgba(255, 255, 255, 0.02)',
                            position: 'relative'
                        }}>
                            {/* Botón eliminar (posición absoluta) */}
                            <Button
                                variant="ghost"
                                type="button"
                                onClick={() => removeArticle(index)}
                                style={{ position: 'absolute', top: '12px', padding: '6px', color: 'var(--error)', float: 'right' }}
                                disabled={isSubmitting}
                            >
                                <Trash2 size={18} />
                            </Button>

                            {/* Renglón 1: Datos principales */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', paddingRight: '36px' }}>
                                <Input label="Descripción" name="descripcion" value={art.descripcion} onChange={(e) => handleArticleChange(index, e)} maxLength={100} required disabled={isSubmitting} />
                                <Select
                                    label="Presentación"
                                    name="presentacion"
                                    value={art.presentacion || 'Bulto(s)'}
                                    onChange={(e) => handleArticleChange(index, e)}
                                    options={['Unidad(es)', 'Bulto(s)', 'Kilo(s)']}
                                    required
                                    disabled={isSubmitting}
                                />
                                <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: '500' }}>Cant.</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
                                        <button
                                            type="button"
                                            disabled={isSubmitting || art.cantidad <= 1}
                                            onClick={() => handleArticleChange(index, { target: { name: 'cantidad', value: Math.max(1, (art.cantidad || 1) - 1) } })}
                                            style={{
                                                padding: '0 14px', height: '46px', minHeight: '46px',
                                                background: 'var(--surface)', border: '1px solid var(--border)',
                                                borderRight: 'none', borderRadius: 'var(--radius) 0 0 var(--radius)',
                                                color: 'var(--text)', fontSize: '1.2rem', cursor: 'pointer',
                                                opacity: isSubmitting || art.cantidad <= 1 ? 0.5 : 1
                                            }}
                                        >−</button>
                                        <input
                                            type="number"
                                            name="cantidad"
                                            value={art.cantidad}
                                            min={1}
                                            step={1}
                                            readOnly
                                            style={{
                                                width: '60px', textAlign: 'center', outline: 'none',
                                                height: '46px', border: '1px solid var(--border)',
                                                borderLeft: 'none', borderRight: 'none',
                                                background: 'var(--surface)', color: 'var(--text)',
                                                fontSize: '1rem', fontWeight: '600'
                                            }}
                                            disabled={isSubmitting}
                                        />
                                        <button
                                            type="button"
                                            disabled={isSubmitting}
                                            onClick={() => handleArticleChange(index, { target: { name: 'cantidad', value: (art.cantidad || 1) + 1 } })}
                                            style={{
                                                padding: '0 14px', height: '46px', minHeight: '46px',
                                                background: 'var(--surface)', border: '1px solid var(--border)',
                                                borderLeft: 'none', borderRadius: '0 var(--radius) var(--radius) 0',
                                                color: 'var(--text)', fontSize: '1.2rem', cursor: 'pointer',
                                                opacity: isSubmitting ? 0.5 : 1
                                            }}
                                        >+</button>
                                    </div>
                                </div>
                            </div>

                            {/* Renglón 2: Logística */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'end', marginTop: '4px' }}>
                                <Select
                                    label="Destino"
                                    name="idLugarDestino"
                                    value={art.idLugarDestino}
                                    onChange={(e) => handleArticleChange(index, e)}
                                    options={lugares.map(l => ({ id: l.id, label: l.nombre }))}
                                    required
                                    includePlaceholder={false}
                                    disabled={isSubmitting}
                                />
                                <Input
                                    label={`Destinatario ${lugares.find(l => String(l.id) === String(art.idLugarDestino))?.esDependencia === 0 ? '' : '(opcional)'}`}
                                    name="destinatario"
                                    value={art.destinatario}
                                    onChange={(e) => handleArticleChange(index, e)}
                                    maxLength={30}
                                    required={lugares.find(l => String(l.id) === String(art.idLugarDestino))?.esDependencia === 0}
                                    disabled={isSubmitting}
                                />
                                <Switch
                                    name="conRetorno"
                                    checked={art.conRetorno !== false}
                                    onChange={(e) => handleArticleChange(index, e)}
                                    activeLabel="Con Retorno"
                                    inactiveLabel="Sin Retorno"
                                    style={{ marginBottom: '16px' }}
                                    disabled={isSubmitting}
                                />
                            </div>
                        </div>
                    ))}
                    {formData.articles.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.875rem' }}>No hay artículos registrados.</p>}
                    {formData.articles.length > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                            <Button variant="secondary" size="sm" type="button" onClick={addArticle} disabled={isSubmitting}>
                                <Plus size={16} />
                                <span className="desktop-only">Agregar Artículo</span>
                                <span className="mobile-only">Agregar</span>
                            </Button>
                        </div>
                    )}
                </Card>

                {import.meta.env.VITE_ENABLE_DOCUMENTS !== 'false' && (
                    <Card>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ fontSize: '1.25rem' }}>Documentación</h2>
                            <Button variant="secondary" size="sm" type="button" onClick={addDocument} disabled={isSubmitting}>
                                <Plus size={16} />
                                <span className="desktop-only">Agregar Documento</span>
                                <span className="mobile-only">Agregar</span>
                            </Button>
                        </div>
                        {formData.documents.map((doc, index) => (
                            <div key={index} style={{
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius)',
                                padding: '20px',
                                paddingTop: '16px',
                                marginBottom: '20px',
                                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                                position: 'relative'
                            }}>
                                {/* Botón eliminar (posición absoluta) */}
                                <Button
                                    variant="ghost"
                                    type="button"
                                    onClick={() => removeDocument(index)}
                                    style={{ position: 'absolute', top: '12px', padding: '6px', color: 'var(--error)', float: 'right' }}
                                    disabled={isSubmitting}
                                >
                                    <Trash2 size={18} />
                                </Button>

                                {/* Renglón 1: Datos principales */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', paddingRight: '36px' }}>
                                    <Select
                                        label="Tipo"
                                        name="tipo"
                                        value={doc.tipo}
                                        onChange={(e) => handleDocumentChange(index, e)}
                                        options={['Remito', 'Factura', 'Presupuesto', 'Orden de compra', 'Otros']}
                                        required
                                        disabled={isSubmitting}
                                    />
                                    <Input label="Descripción" name="descripcion" value={doc.descripcion} onChange={(e) => handleDocumentChange(index, e)} maxLength={100} required disabled={isSubmitting} />
                                    <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <label style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: '500' }}>Cant.</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
                                            <button
                                                type="button"
                                                disabled={isSubmitting || doc.cantidad <= 1}
                                                onClick={() => handleDocumentChange(index, { target: { name: 'cantidad', value: Math.max(1, (doc.cantidad || 1) - 1) } })}
                                                style={{
                                                    padding: '0 14px', height: '46px', minHeight: '46px',
                                                    background: 'var(--surface)', border: '1px solid var(--border)',
                                                    borderRight: 'none', borderRadius: 'var(--radius) 0 0 var(--radius)',
                                                    color: 'var(--text)', fontSize: '1.2rem', cursor: 'pointer',
                                                    opacity: isSubmitting || doc.cantidad <= 1 ? 0.5 : 1
                                                }}
                                            >−</button>
                                            <input
                                                type="number"
                                                name="cantidad"
                                                value={doc.cantidad}
                                                min={1}
                                                step={1}
                                                readOnly
                                                style={{
                                                    width: '60px', textAlign: 'center', outline: 'none',
                                                    height: '46px', border: '1px solid var(--border)',
                                                    borderLeft: 'none', borderRight: 'none',
                                                    background: 'var(--surface)', color: 'var(--text)',
                                                    fontSize: '1rem', fontWeight: '600'
                                                }}
                                                disabled={isSubmitting}
                                            />
                                            <button
                                                type="button"
                                                disabled={isSubmitting}
                                                onClick={() => handleDocumentChange(index, { target: { name: 'cantidad', value: (doc.cantidad || 1) + 1 } })}
                                                style={{
                                                    padding: '0 14px', height: '46px', minHeight: '46px',
                                                    background: 'var(--surface)', border: '1px solid var(--border)',
                                                    borderLeft: 'none', borderRadius: '0 var(--radius) var(--radius) 0',
                                                    color: 'var(--text)', fontSize: '1.2rem', cursor: 'pointer',
                                                    opacity: isSubmitting ? 0.5 : 1
                                                }}
                                            >+</button>
                                        </div>
                                    </div>
                                </div>

                                {/* Renglón 2: Logística */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'end', marginTop: '4px' }}>
                                    <Select
                                        label="Destino"
                                        name="idLugarDestino"
                                        value={doc.idLugarDestino}
                                        onChange={(e) => handleDocumentChange(index, e)}
                                        options={lugares.map(l => ({ id: l.id, label: l.nombre }))}
                                        required
                                        includePlaceholder={false}
                                        disabled={isSubmitting}
                                    />
                                    <Input
                                        label={`Destinatario ${lugares.find(l => String(l.id) === String(doc.idLugarDestino))?.esDependencia === 0 ? '' : '(opcional)'}`}
                                        name="destinatario"
                                        value={doc.destinatario}
                                        onChange={(e) => handleDocumentChange(index, e)}
                                        maxLength={30}
                                        required={lugares.find(l => String(l.id) === String(doc.idLugarDestino))?.esDependencia === 0}
                                        disabled={isSubmitting}
                                    />
                                    <Switch
                                        name="conRetorno"
                                        checked={doc.conRetorno !== false}
                                        onChange={(e) => handleDocumentChange(index, e)}
                                        activeLabel="Con Retorno"
                                        inactiveLabel="Sin Retorno"
                                        style={{ marginBottom: '16px' }}
                                        disabled={isSubmitting}
                                    />
                                </div>
                            </div>
                        ))}
                        {formData.documents.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.875rem' }}>No hay documentos registrados.</p>}
                        {formData.documents.length > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                                <Button variant="secondary" size="sm" type="button" onClick={addDocument} disabled={isSubmitting}>
                                    <Plus size={16} />
                                    <span className="desktop-only">Agregar Documento</span>
                                    <span className="mobile-only">Agregar</span>
                                </Button>
                            </div>
                        )}
                    </Card>
                )}

                <div style={{ marginTop: '32px' }}>
                    <Button
                        variant="primary"
                        type="submit"
                        loading={isSubmitting}
                        style={{
                            width: '100%',
                            padding: '18px',
                            fontSize: '1.25rem',
                            fontWeight: '700',
                            gap: '12px'
                        }}
                    >
                        <Send size={20} /> {isSubmitting ? 'Procesando...' : (userIsAutorizador ? 'Generar Solicitud' : 'Enviar para Autorización')}
                    </Button>
                </div>
            </form>

            {/* Modal de error: Usuario sin legajo */}
            <Modal
                isOpen={showAuthModal}
                onClose={() => { }} // No permitir cerrar
                title="Acceso Restringido"
                type="error"
                message={
                    authModalType === 'rate_limit' ? (
                        <div>
                            <p><strong>⚠️ Demasiadas solicitudes detectadas.</strong></p>
                            <p>Tu acceso ha sido bloqueado temporalmente por el servidor por seguridad. Por favor, aguardá unos minutos y refrescá la página para continuar.</p>
                        </div>
                    ) : authModalType === 'not_found' ? (
                        <div>
                            <p>No se pudo encontrar un legajo asociado a tu cuenta (<strong>{currentUser.username || currentUser.email}</strong>).</p>
                            <p>Por favor, contactá con el Administrador del Sistema para regularizar tu situación antes de generar solicitudes.</p>
                        </div>
                    ) : (
                        <div>
                            <p>Ocurrió un error al verificar tus credenciales con el servidor.</p>
                            <p>Por favor, verificá tu conexión a internet o intentá nuevamente en unos instantes.</p>
                        </div>
                    )
                }
                confirmLabel="Entendido"
                showCancel={false}
                onConfirm={() => window.location.href = '/'}
            />

            {/* Modal de advertencia: Auto-autorización */}
            <Modal
                isOpen={showSelfAuthWarning}
                onClose={() => setShowSelfAuthWarning(false)}
                title="Advertencia"
                type="warning"
                message={
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', color: '#ffcc00' }}>
                            <AlertTriangle size={32} />
                            <strong style={{ fontSize: '1.2rem' }}>Auto-autorización detectada</strong>
                        </div>
                        <p>Te estás autorizando a vos mismo/a.</p>
                        <p>Si confirmás, la autorización será generada de todos modos, sin embargo, se mantendrá registro de ello para su posterior auditoría.</p>
                        <p>¿Deseás continuar con la operación?</p>
                    </div>
                }
                confirmLabel="Confirmar y Continuar"
                cancelLabel="Cancelar"
                onConfirm={executeSubmit}
            />

            {/* Modal de error: Autorización Duplicada */}
            <Modal
                isOpen={showDuplicateModal}
                onClose={() => setShowDuplicateModal(false)}
                title="Autorización Duplicada"
                type="error"
                message={
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', color: 'var(--dy-red)' }}>
                            <AlertTriangle size={32} />
                            <strong style={{ fontSize: '1.2rem' }}>Existe una autorización activa</strong>
                        </div>
                        <p>{duplicateModalMessage}</p>
                    </div>
                }
                confirmLabel="Entendido"
                showCancel={false}
                onConfirm={() => setShowDuplicateModal(false)}
            />
        </div>
    );
};

export default MovementForm;
