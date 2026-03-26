const pool = require('../config/db');
const { movementSchema } = require('../validations/movementSchema');
const notificationService = require('../services/notificationService');

// Estado IDs
const ESTADO_PENDIENTE = 1;
const ESTADO_COMPLETADO = 2;
const ESTADO_VENCIDO = 3;
const ESTADO_SOLICITADO = 4;
const ESTADO_RECHAZADO = 5;
const ESTADO_ANULADO = 6;

// @desc    Create a new movement
// @route   POST /api/movements
exports.createMovement = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        let validatedData;
        try {
            validatedData = movementSchema.parse(req.body);
        } catch (validationError) {
            return res.status(400).json({ error: 'Validation failed', details: validationError.errors });
        }

        const {
            movement,
            articles = [],
            documents = []
        } = validatedData;

        // 1. Obtener todos los lugares involucrados para verificar esDependencia
        const lugarIds = new Set();
        lugarIds.add(movement.idLugarDestino);
        articles.forEach(a => lugarIds.add(a.idLugarDestino));
        documents.forEach(d => lugarIds.add(d.idLugarDestino));

        const [lugarRows] = await connection.query(
            'SELECT id, esDependencia FROM lugares WHERE id IN (?)',
            [[...lugarIds]]
        );
        const lugarMap = Object.fromEntries(lugarRows.map(r => [r.id, r.esDependencia]));

        // 2. Validar destino principal del movimiento
        if (lugarMap[movement.idLugarDestino] === 0) {
            if (!movement.destinoDetalle || movement.destinoDetalle.trim() === '') {
                await connection.release();
                return res.status(400).json({ error: 'Validation failed', details: [{ message: 'El destino requiere detallar la dirección/lugar' }] });
            }
        }

        // 3. Validar destinatarios de artículos
        for (const art of articles) {
            if (lugarMap[art.idLugarDestino] === 0 && (!art.destinatario || art.destinatario.trim() === '')) {
                await connection.release();
                return res.status(400).json({
                    error: 'Validation failed',
                    details: [{ message: `Destinatario requerido para el artículo "${art.descripcion}" con destino exterior` }]
                });
            }
        }

        // 4. Validar destinatarios de documentos
        for (const doc of documents) {
            if (lugarMap[doc.idLugarDestino] === 0 && (!doc.destinatario || doc.destinatario.trim() === '')) {
                await connection.release();
                return res.status(400).json({
                    error: 'Validation failed',
                    details: [{ message: `Destinatario requerido para el documento "${doc.descripcion}" con destino exterior` }]
                });
            }
        }

        // Lookup usuario actual en legajos
        const [userRows] = await connection.query(
            'SELECT legajo, esAutorizador, idRol FROM legajos WHERE email = ?',
            [movement.usuario_app]
        );
        if (userRows.length === 0) {
            await connection.release();
            return res.status(403).json({ error: 'Usuario no autorizado para firmar solicitudes (Email no encontrado en legajos)' });
        }
        const currentUserLegajo = userRows[0].legajo;
        const currentUserEsAutorizador = userRows[0].esAutorizador === 1;

        // Determinar autorizante y estado inicial
        let personaAutorizanteLegajo;
        let idEstadoInicial;
        let autorizanteEmail = null; // email del autorizante para notificación

        if (currentUserEsAutorizador) {
            personaAutorizanteLegajo = currentUserLegajo;
            idEstadoInicial = ESTADO_PENDIENTE;
        } else {
            if (!movement.personaAutorizante) {
                await connection.release();
                return res.status(400).json({ error: 'Validation failed', details: [{ message: 'Debe seleccionar un autorizante para el movimiento' }] });
            }
            const [authRows] = await connection.query(
                'SELECT legajo, esAutorizador, email FROM legajos WHERE legajo = ?',
                [movement.personaAutorizante]
            );
            if (authRows.length === 0 || authRows[0].esAutorizador !== 1) {
                await connection.release();
                return res.status(400).json({ error: 'Validation failed', details: [{ message: 'El autorizante seleccionado no tiene permisos de autorización' }] });
            }
            personaAutorizanteLegajo = movement.personaAutorizante;
            idEstadoInicial = ESTADO_SOLICITADO;
            autorizanteEmail = authRows[0].email; // guardar para la notificación
        }

        // 5. Insert Movement
        const [movResult] = await connection.query(
            `INSERT INTO movimientos 
            (idGrupo, ordenGrupo, idTipo, personaInterna, idPersonaExterna, fechaHoraRegistro, conRegreso, motivo, personaAutorizante, observacion, idEstado, idLugarOrigen, idLugarDestino, destinoDetalle, usuario_app, esRecurrente, vencimientoRecurrencias) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                0, 1,
                movement.idTipo,
                movement.personaInterna || null,
                movement.idPersonaExterna || null,
                `${movement.fechaHoraRegistro} 00:00:00`,
                movement.conRegreso ? 1 : 0,
                movement.motivo,
                personaAutorizanteLegajo,
                movement.observacion || '',
                idEstadoInicial,
                movement.idLugarOrigen,
                movement.idLugarDestino,
                movement.destinoDetalle || '',
                movement.usuario_app,
                movement.esRecurrente ? 1 : 0,
                movement.vencimientoRecurrencias || null
            ]
        );

        const movementId = movResult.insertId;

        // 6. Insert Articles
        if (articles.length > 0) {
            for (const art of articles) {
                await connection.query(
                    `INSERT INTO articulos 
                    (idMovimiento, descripcion, cantidad, idEstado, idLugarOrigen, idLugarDestino, remitente, destinatario, sinRetorno, presentacion, observacion, usuario_app) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        movementId,
                        art.descripcion,
                        art.cantidad || 1,
                        idEstadoInicial === ESTADO_SOLICITADO ? ESTADO_SOLICITADO : (art.idEstado || 1),
                        art.idLugarOrigen || movement.idLugarOrigen,
                        art.idLugarDestino || movement.idLugarDestino,
                        art.remitente || '',
                        art.destinatario || '',
                        art.sinRetorno ? 1 : 0,
                        art.presentacion || 'Unidad(es)',
                        art.observacion || '',
                        movement.usuario_app
                    ]
                );
            }
        }

        // 7. Insert Documents
        if (documents.length > 0) {
            if (process.env.ENABLE_DOCUMENTS === 'false') {
                await connection.rollback();
                connection.release();
                return res.status(400).json({ error: 'La carga de documentos está deshabilitada temporalmente.' });
            }
            for (const doc of documents) {
                await connection.query(
                    `INSERT INTO documentos 
                    (idMovimiento, descripcion, cantidad, idEstado, tipo, idLugarOrigen, idLugarDestino, remitente, destinatario, sinRetorno, observacion, usuario_app) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        movementId,
                        doc.descripcion || '',
                        doc.cantidad || 1,
                        idEstadoInicial === ESTADO_SOLICITADO ? ESTADO_SOLICITADO : (doc.idEstado || 1),
                        doc.tipo,
                        doc.idLugarOrigen || movement.idLugarOrigen,
                        doc.idLugarDestino || movement.idLugarDestino,
                        doc.remitente || '',
                        doc.destinatario || '',
                        doc.sinRetorno ? 1 : 0,
                        doc.observacion || '',
                        movement.usuario_app
                    ]
                );
            }
        }

        // 8. Generar movimientos derivados
        if (idEstadoInicial === ESTADO_PENDIENTE) {
            const [[origenInfo]] = await connection.query('SELECT esDependencia FROM lugares WHERE id = ?', [movement.idLugarOrigen]);
            const [[destinoInfo]] = await connection.query('SELECT esDependencia FROM lugares WHERE id = ?', [movement.idLugarDestino]);
            const ambosDependencias = origenInfo?.esDependencia === 1 && destinoInfo?.esDependencia === 1;

            if (movement.conRegreso) {
                // Caso A: con retorno → el SP genera los 4 registros del ciclo completo
                console.log(`Invocando movimientos derivados (conRegreso) para ID: ${movementId}`);
                try {
                    await connection.query('CALL sp_GenerarMovimientosDerivados(?)', [movementId]);
                } catch (spError) {
                    console.error('Error en Store Procedure sp_GenerarMovimientosDerivados:', spError);
                    throw new Error(`Error procesando movimientos derivados: ${spError.message}`);
                }
            } else if (ambosDependencias) {
                // Caso B: sin retorno entre dos dependencias internas
                // Generar manualmente el INGRESO en destino (orden 2), con origen/destino invertidos
                console.log(`Generando INGRESO derivado (inter-dependencia sin retorno) para ID: ${movementId}`);

                // Asignar idGrupo: usar el id del movimiento como grupo único
                const nuevoGrupo = movementId;
                await connection.query('UPDATE movimientos SET idGrupo = ? WHERE id = ?', [nuevoGrupo, movementId]);

                await connection.query(
                    `INSERT INTO movimientos
                     (idGrupo, ordenGrupo, idTipo, personaInterna, idPersonaExterna, fechaHoraRegistro,
                      conRegreso, motivo, personaAutorizante, observacion, idEstado,
                      idLugarOrigen, idLugarDestino, destinoDetalle, usuario_app)
                     VALUES (?, 2, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        nuevoGrupo,
                        movement.idTipo === 1 ? 2 : 1,          // Egreso→Ingreso o Ingreso→Egreso
                        movement.personaInterna || null,
                        movement.idPersonaExterna || null,
                        `${movement.fechaHoraRegistro} 00:00:00`,
                        movement.motivo,
                        personaAutorizanteLegajo,
                        movement.observacion || '',
                        1,                                       // Pendiente
                        movement.idLugarOrigen,                 // Mantiene origen
                        movement.idLugarDestino,                // Mantiene destino
                        movement.destinoDetalle || '',
                        movement.usuario_app
                    ]
                );
                console.log(`INGRESO derivado generado en grupo ${nuevoGrupo}`);
            }
        }

        await connection.commit();

        const statusMsg = idEstadoInicial === ESTADO_SOLICITADO
            ? 'Solicitud enviada al autorizante. Quedará en estado "Solicitado" hasta ser aprobada.'
            : (movement.conRegreso
                ? 'Solicitud y movimientos derivados generados correctamente'
                : 'Movimiento creado exitosamente');

        res.status(201).json({
            message: statusMsg,
            id: movementId,
            estado: idEstadoInicial
        });

        // 9. Enviar notificación push al autorizante (fuera de la transacción)
        if (idEstadoInicial === ESTADO_SOLICITADO && autorizanteEmail) {
            try {
                console.log(`[Push] Notificando al autorizante: ${autorizanteEmail}`);
                const [typeRows] = await pool.query('SELECT nombre FROM movimientoTipos WHERE id = ?', [movement.idTipo]);
                const [persRows] = await pool.query('SELECT apellido_nombre FROM legajos WHERE legajo = ?', [movement.personaInterna]);
                
                await notificationService.notifyNewRequest(autorizanteEmail, {
                    persona_interna_nombre: persRows[0]?.apellido_nombre || movement.personaInterna,
                    tipo_nombre: typeRows[0]?.nombre || 'movimiento'
                });
            } catch (notifErr) {
                console.error('[Push] Error notificando al autorizante:', notifErr);
            }
        } else if (idEstadoInicial === ESTADO_SOLICITADO) {
            console.warn('[Push] No se pudo notificar al autorizante: autorizanteEmail es null');
        }

        // 10. Si el autorizante creó en nombre de otro, notificar al solicitante (personaInterna)
        if (idEstadoInicial === ESTADO_PENDIENTE) {
            // El autorizante firmó el movimiento directamente → notificar al solicitante (personaInterna)
            try {
                const [typeRows] = await pool.query('SELECT nombre FROM movimientoTipos WHERE id = ?', [movement.idTipo]);
                const [authNameRows] = await pool.query('SELECT apellido_nombre FROM legajos WHERE legajo = ?', [currentUserLegajo]);
                // Buscar el email del solicitante (personaInterna)
                const [persEmailRows] = await pool.query('SELECT email FROM legajos WHERE legajo = ?', [movement.personaInterna]);

                if (persEmailRows[0]?.email && persEmailRows[0].email !== movement.usuario_app) {
                    console.log(`[Push] Notificando al solicitante (creado en su nombre): ${persEmailRows[0].email}`);
                    await notificationService.notifyMovementCreatedForYou(persEmailRows[0].email, {
                        autorizante_nombre: authNameRows[0]?.apellido_nombre || 'El autorizante',
                        tipo_nombre: typeRows[0]?.nombre || 'movimiento'
                    });
                }
            } catch (err) {
                console.error('[Push] Error notificando al solicitante sobre movimiento creado en su nombre:', err);
            }
        }

    } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
};

// @desc    Get all movements (with basic details)
// @route   GET /api/movements
exports.getMovements = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT m.*, mt.nombre as tipo_nombre, me.nombre as estado_nombre, 
                    lo.nombre as origen_nombre, ld.nombre as destino_nombre,
                    l.apellido_nombre as autorizante_nombre,
                    lp.apellido_nombre as persona_interna_nombre
             FROM movimientos m
             JOIN movimientoTipos mt ON m.idTipo = mt.id
             JOIN movimientoEstados me ON m.idEstado = me.id
             JOIN lugares lo ON m.idLugarOrigen = lo.id
             JOIN lugares ld ON m.idLugarDestino = ld.id
             LEFT JOIN legajos l ON m.personaAutorizante = l.legajo
             LEFT JOIN legajos lp ON m.personaInterna = lp.legajo
             ORDER BY m.fechaHoraRegistro DESC`
        );

        // Fetch articles and documents for these movements
        if (rows.length > 0) {
            const movementIds = rows.map(r => r.id);
            const [articles] = await pool.query(
                `SELECT a.*, lo.nombre as origen_nombre, ld.nombre as destino_nombre
                 FROM articulos a
                 LEFT JOIN lugares lo ON a.idLugarOrigen = lo.id
                 LEFT JOIN lugares ld ON a.idLugarDestino = ld.id
                 WHERE a.idMovimiento IN (?)`,
                [movementIds]
            );
            const [documents] = await pool.query(
                `SELECT d.*, lo.nombre as origen_nombre, ld.nombre as destino_nombre
                 FROM documentos d
                 LEFT JOIN lugares lo ON d.idLugarOrigen = lo.id
                 LEFT JOIN lugares ld ON d.idLugarDestino = ld.id
                 WHERE d.idMovimiento IN (?)`,
                [movementIds]
            );

            rows.forEach(mov => {
                mov.articulos = articles.filter(a => a.idMovimiento === mov.id);
                mov.documentos = documents.filter(d => d.idMovimiento === mov.id);
            });
        }

        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// @desc    Get movements for the current user (paginated, group-aware)
// @route   GET /api/movements/mis-solicitudes?email=...&page=1&filtro=todos
exports.getMisSolicitudes = async (req, res) => {
    const { email, filtro = 'todos' } = req.query;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const pageSize = parseInt(process.env.PAGE_SIZE_SOLICITUDES) || 20;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const offset = (page - 1) * pageSize;

    try {
        const [userRows] = await pool.query(
            'SELECT legajo, esAutorizador, idRol FROM legajos WHERE email = ?',
            [email]
        );
        if (userRows.length === 0) return res.status(404).json({ error: 'User not found' });

        const { legajo, esAutorizador, idRol } = userRows[0];

        // Condición de acceso por usuario/rol
        let whereClause;
        let whereParams;

        if (idRol >= 100) {
            // Sysadmin: acceso total a todos los movimientos
            whereClause = '1=1';
            whereParams = [];
        } else if (esAutorizador) {
            whereClause = '(m.usuario_app = ? OR m.personaAutorizante = ?)';
            whereParams = [email, legajo];
        } else {
            whereClause = 'm.usuario_app = ?';
            whereParams = [email];
        }

        // Filtro adicional por estado
        const filtroMap = {
            'solicitado': ESTADO_SOLICITADO,
            'pendiente': ESTADO_PENDIENTE,
            'completado': ESTADO_COMPLETADO,
            'rechazado': ESTADO_RECHAZADO,
            'vencido': ESTADO_VENCIDO,
            'anulado': ESTADO_ANULADO,
            'accion': ESTADO_SOLICITADO,
        };
        if (filtroMap[filtro] !== undefined) {
            whereClause += ' AND m.idEstado = ?';
            whereParams.push(filtroMap[filtro]);
        }

        const baseQuery = `
            FROM movimientos m
            JOIN movimientoTipos mt ON m.idTipo = mt.id
            JOIN movimientoEstados me ON m.idEstado = me.id
            JOIN lugares lo ON m.idLugarOrigen = lo.id
            JOIN lugares ld ON m.idLugarDestino = ld.id
            LEFT JOIN legajos l ON m.personaAutorizante = l.legajo
            LEFT JOIN legajos lp ON m.personaInterna = lp.legajo
            WHERE ${whereClause}
            -- Agrupación inteligente: evitar ruido de series encadenadas (ej. retorno)
            -- Muestra registros simples, registros finalizados, y solo el SIGUIENTE paso activo de una serie
            AND (
                m.idGrupo = 0
                OR m.idEstado NOT IN (${ESTADO_PENDIENTE}, ${ESTADO_SOLICITADO})
                OR (
                    m.idGrupo > 0
                    AND m.idEstado IN (${ESTADO_PENDIENTE}, ${ESTADO_SOLICITADO})
                    AND m.ordenGrupo = (
                        SELECT MIN(m2.ordenGrupo)
                        FROM movimientos m2
                        WHERE m2.idGrupo = m.idGrupo
                          AND m2.idEstado IN (${ESTADO_PENDIENTE}, ${ESTADO_SOLICITADO})
                    )
                )
            )`;

        // Total para paginación
        const [[{ total }]] = await pool.query(
            `SELECT COUNT(*) as total ${baseQuery}`,
            whereParams
        );

        // Datos paginados + información del grupo
        const [rows] = await pool.query(
            `SELECT m.*, mt.nombre as tipo_nombre, me.nombre as estado_nombre,
                    lo.nombre as origen_nombre, ld.nombre as destino_nombre,
                    l.apellido_nombre as autorizante_nombre,
                    lp.apellido_nombre as persona_interna_nombre,
                    CASE WHEN m.idGrupo > 0
                         THEN (SELECT COUNT(*) FROM movimientos mg WHERE mg.idGrupo = m.idGrupo)
                         ELSE 0 END AS grupo_total,
                    CASE WHEN m.idGrupo > 0
                         THEN (SELECT COUNT(*) FROM movimientos mc WHERE mc.idGrupo = m.idGrupo AND mc.idEstado = ${ESTADO_COMPLETADO})
                         ELSE 0 END AS grupo_completados
             ${baseQuery}
             ORDER BY (m.idEstado IN (${ESTADO_PENDIENTE}, ${ESTADO_SOLICITADO})) DESC, m.fechaHoraRegistro DESC
             LIMIT ? OFFSET ?`,
            [...whereParams, pageSize, offset]
        );

        // Fetch articles and documents for these movements
        if (rows.length > 0) {
            const movementIds = rows.map(r => r.id);
            const [articles] = await pool.query(
                `SELECT a.*, lo.nombre as origen_nombre, ld.nombre as destino_nombre
                 FROM articulos a
                 LEFT JOIN lugares lo ON a.idLugarOrigen = lo.id
                 LEFT JOIN lugares ld ON a.idLugarDestino = ld.id
                 WHERE a.idMovimiento IN (?)`,
                [movementIds]
            );
            const [documents] = await pool.query(
                `SELECT d.*, lo.nombre as origen_nombre, ld.nombre as destino_nombre
                 FROM documentos d
                 LEFT JOIN lugares lo ON d.idLugarOrigen = lo.id
                 LEFT JOIN lugares ld ON d.idLugarDestino = ld.id
                 WHERE d.idMovimiento IN (?)`,
                [movementIds]
            );

            rows.forEach(mov => {
                mov.articulos = articles.filter(a => a.idMovimiento === mov.id);
                mov.documentos = documents.filter(d => d.idMovimiento === mov.id);
            });
        }

        // Badge de solicitados pendientes de acción (solo autorizadores)
        let pendingActionCount = 0;
        if (esAutorizador) {
            const [[{ cnt }]] = await pool.query(
                `SELECT COUNT(*) as cnt FROM movimientos m
                 WHERE m.personaAutorizante = ? AND m.idEstado = ?`,
                [legajo, ESTADO_SOLICITADO]
            );
            pendingActionCount = cnt;
        }

        res.json({
            movements: rows,
            esAutorizador: esAutorizador === 1,
            pendingActionCount,
            pagination: {
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize)
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// @desc    Approve a movement (only for authorizers)
// @route   PUT /api/movements/:id/approve
exports.approveMovement = async (req, res) => {
    const { id } = req.params;
    const { email } = req.body;

    if (!email) return res.status(400).json({ error: 'Email is required' });

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [userRows] = await connection.query(
            'SELECT legajo, esAutorizador, idRol FROM legajos WHERE email = ?',
            [email]
        );
        if (userRows.length === 0 || !userRows[0].esAutorizador) {
            return res.status(403).json({ error: 'No tenés permisos de autorización' });
        }
        const authLegajo = userRows[0].legajo;

        const [movRows] = await connection.query(
            'SELECT * FROM movimientos WHERE id = ?',
            [id]
        );
        if (movRows.length === 0) return res.status(404).json({ error: 'Movimiento no encontrado' });

        const mov = movRows[0];

        if (mov.idEstado !== ESTADO_SOLICITADO) {
            return res.status(400).json({ error: 'Solo se pueden aprobar movimientos en estado "Solicitado"' });
        }
        if (mov.personaAutorizante !== authLegajo && userRows[0].idRol < 100) {
            return res.status(403).json({ error: 'No sos el autorizante asignado a este movimiento' });
        }

        // Pasar a Pendiente (articulos/documentos no se tocan, mantienen su estado propio)
        await connection.query(
            'UPDATE movimientos SET idEstado = ? WHERE id = ?',
            [ESTADO_PENDIENTE, id]
        );

        // Si conRegreso, generar movimientos derivados (todos nacen en Pendiente)
        if (mov.conRegreso) {
            try {
                await connection.query('CALL sp_GenerarMovimientosDerivados(?)', [parseInt(id)]);
            } catch (spError) {
                console.error('Error en SP al aprobar:', spError);
                throw new Error(`Error al generar movimientos derivados: ${spError.message}`);
            }
        }

        await connection.commit();
        const msg = mov.conRegreso
            ? 'Movimiento aprobado. La serie completa de movimientos encadenados está en estado Pendiente.'
            : 'Movimiento aprobado correctamente. Estado: Pendiente.';

        res.json({ message: msg });

        // 9. Notificar al solicitante
        if (mov.usuario_app) {
            notificationService.notifyRequestStatus(mov.usuario_app, id, 'approved');
        }
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
};

// @desc    Reject a movement (only for authorizers)
// @route   PUT /api/movements/:id/reject
exports.rejectMovement = async (req, res) => {
    const { id } = req.params;
    const { email, observacion } = req.body;

    if (!email) return res.status(400).json({ error: 'Email is required' });

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [userRows] = await connection.query(
            'SELECT legajo, esAutorizador, idRol FROM legajos WHERE email = ?',
            [email]
        );
        if (userRows.length === 0 || !userRows[0].esAutorizador) {
            return res.status(403).json({ error: 'No tenés permisos de autorización' });
        }
        const authLegajo = userRows[0].legajo;

        const [movRows] = await connection.query(
            'SELECT * FROM movimientos WHERE id = ?',
            [id]
        );
        if (movRows.length === 0) return res.status(404).json({ error: 'Movimiento no encontrado' });

        const mov = movRows[0];

        // Solo se puede rechazar un Solicitado (antes de que existan derivados)
        if (mov.idEstado !== ESTADO_SOLICITADO) {
            return res.status(400).json({ error: 'Solo se pueden rechazar movimientos en estado "Solicitado"' });
        }
        if (mov.personaAutorizante !== authLegajo && userRows[0].idRol < 100) {
            return res.status(403).json({ error: 'No sos el autorizante asignado a este movimiento' });
        }

        const newObs = observacion
            ? `[RECHAZADO] ${observacion}`
            : (mov.observacion ? `[RECHAZADO] ${mov.observacion}` : '[RECHAZADO]');

        // Solo actualiza el movimiento; articulos y documentos mantienen su estado propio (objetoEstados)
        await connection.query(
            'UPDATE movimientos SET idEstado = ?, observacion = ? WHERE id = ?',
            [ESTADO_RECHAZADO, newObs, id]
        );

        await connection.commit();
        res.json({ message: 'Movimiento rechazado. Los artículos y documentos asociados también fueron actualizados.' });

        // 9. Notificar al solicitante
        if (mov.usuario_app) {
            notificationService.notifyRequestStatus(mov.usuario_app, id, 'rejected', { observacion });
        }
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
};

// @desc    Cancel/anull a movement (only for authorizers)
//          Anula toda la serie activa del grupo (sp_AnularGrupo)
// @route   PUT /api/movements/:id/cancel
exports.cancelMovement = async (req, res) => {
    const { id } = req.params;
    const { email, observacion } = req.body;

    if (!email) return res.status(400).json({ error: 'Email is required' });

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [userRows] = await connection.query(
            'SELECT legajo, esAutorizador, idRol FROM legajos WHERE email = ?',
            [email]
        );
        if (userRows.length === 0 || !userRows[0].esAutorizador) {
            return res.status(403).json({ error: 'No tenés permisos de autorización' });
        }
        const authLegajo = userRows[0].legajo;

        const [movRows] = await connection.query(
            'SELECT * FROM movimientos WHERE id = ?',
            [id]
        );
        if (movRows.length === 0) return res.status(404).json({ error: 'Movimiento no encontrado' });

        const mov = movRows[0];

        if (mov.idEstado !== ESTADO_PENDIENTE) {
            return res.status(400).json({ error: 'Solo se pueden anular movimientos en estado "Pendiente"' });
        }
        if (mov.personaAutorizante !== authLegajo && userRows[0].idRol < 100) {
            return res.status(403).json({ error: 'No sos el autorizante asignado a este movimiento' });
        }

        // sp_AnularGrupo anula toda la serie activa; articulos y documentos mantienen su estado propio
        await connection.query(
            'CALL sp_AnularGrupo(?, ?)',
            [parseInt(id), observacion || '']
        );

        await connection.commit();

        // Verificar si había derivados para dar mensaje adecuado
        const idGrupo = mov.idGrupo;
        const tieneGrupo = idGrupo > 0;

        res.json({
            message: tieneGrupo
                ? 'Serie de movimientos anulada correctamente. Todos los movimientos activos del grupo fueron anulados.'
                : 'Movimiento anulado correctamente.'
        });

        // 9. Notificar al solicitante
        if (mov.usuario_app) {
            notificationService.notifyRequestStatus(mov.usuario_app, id, 'cancelled', { observacion });
        }
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
};

// @desc    Get current status of a movement
// @route   GET /api/movements/:id/status
exports.getMovementStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(
            'SELECT idEstado FROM movimientos WHERE id = ?',
            [id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Movimiento no encontrado' });
        }
        res.json({ idEstado: rows[0].idEstado });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
