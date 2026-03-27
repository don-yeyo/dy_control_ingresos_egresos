const pool = require('../config/db');
const crypto = require('crypto');
const notificationService = require('../services/notificationService');

const ESTADO_PENDIENTE = 1;
const ESTADO_COMPLETADO = 2;

// Helper para obtener hoy en formato YYYY-MM-DD ajustado a Argentina
function getHoyArgentina() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
}

// Helper para obtener el día siguiente en formato YYYY-MM-DD ajustado a Argentina
function getSiguienteDiaArgentina() {
    const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toLocaleDateString('en-CA');
}

// Helper para obtener fecha+hora actual en formato YYYY-MM-DD HH:MM:SS ajustado a Argentina
function getNowArgentina() {
    const now = new Date();
    const str = now.toLocaleString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });
    // sv-SE produce "YYYY-MM-DD HH:MM:SS" directamente
    return str;
}

// ---------------------------------------------------------------
// Helper: obtener los idLugar que controla la portería del email
// ---------------------------------------------------------------
async function getLugaresDePorteria(email) {
    const [rows] = await pool.query(
        `SELECT pd.idLugar
         FROM porterias p
         JOIN porteriaDependencias pd ON pd.idPorteria = p.id
         WHERE p.email = ? AND p.activa = 1`,
        [email]
    );
    return rows.map(r => r.idLugar);
}

// ---------------------------------------------------------------
// @desc  Verificar si un email es de portería (para el guard)
// @route GET /api/porteria/check?email=
// ---------------------------------------------------------------
exports.checkPorteria = async (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'Email requerido' });

    try {
        const [rows] = await pool.query(
            'SELECT id, nombre FROM porterias WHERE email = ? AND activa = 1',
            [email]
        );
        if (rows.length === 0) return res.json({ esPortero: false });
        res.json({ esPortero: true, porteria: rows[0] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ---------------------------------------------------------------
// @desc  Movimientos pendientes del día para la portería
// @route GET /api/porteria/pendientes?email=
// ---------------------------------------------------------------
exports.getPendientes = async (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'Email requerido' });

    const hoy = getHoyArgentina();
    const manana = getSiguienteDiaArgentina();
    const lugarIds = await getLugaresDePorteria(email);

    if (lugarIds.length === 0) {
        return res.status(403).json({ error: 'No tenés lugares de portería asignados (o portería inactiva)' });
    }

    console.log(`[PENDIENTES] User: ${email}, Hoy: ${hoy}, Mañana: ${manana}, Lugares: ${lugarIds}`);

    try {
        // Movimientos pendientes cuyo origen o destino es uno de los lugares de la portería.
        // Respeta lógica de grupos: solo el primer paso no completado de cada grupo.
        const [movements] = await pool.query(
            `SELECT m.*,
                    mt.nombre  AS tipo_nombre,
                    me.nombre  AS estado_nombre,
                    lo.nombre  AS origen_nombre,
                    ld.nombre  AS destino_nombre,
                    lp.apellido_nombre  AS persona_interna_nombre,
                    le.apellido_nombre  AS autorizante_nombre,
                    CASE WHEN m.idGrupo > 0
                         THEN (SELECT COUNT(*) FROM movimientos mg WHERE mg.idGrupo = m.idGrupo)
                         ELSE 0 END AS grupo_total,
                    CASE WHEN m.idGrupo > 0
                         THEN (SELECT COUNT(*) FROM movimientos mc WHERE mc.idGrupo = m.idGrupo AND mc.idEstado = ?)
                         ELSE 0 END AS grupo_completados
             FROM movimientos m
             JOIN movimientoTipos    mt ON m.idTipo     = mt.id
             JOIN movimientoEstados  me ON m.idEstado   = me.id
             JOIN lugares            lo ON m.idLugarOrigen  = lo.id
             JOIN lugares            ld ON m.idLugarDestino = ld.id
             LEFT JOIN legajos       lp ON m.personaInterna = lp.legajo
             LEFT JOIN legajos       le ON m.personaAutorizante = le.legajo
             WHERE m.idEstado = ?
               AND (DATE(m.fechaHoraRegistro) = ? OR DATE(m.fechaHoraRegistro) = ?)
               AND (
                   (mt.direccion = 'saliente' AND m.idLugarOrigen IN (?))
                   OR (mt.direccion = 'entrante' AND m.idLugarDestino IN (?))
               )
               AND (
                   m.idGrupo = 0
                   OR m.ordenGrupo = (
                       SELECT MIN(m2.ordenGrupo)
                       FROM movimientos m2
                       WHERE m2.idGrupo = m.idGrupo
                         AND m2.idEstado != ?
                   )
               )
             ORDER BY m.fechaHoraRegistro ASC`,
            [ESTADO_COMPLETADO, ESTADO_PENDIENTE, hoy, manana, lugarIds, lugarIds, ESTADO_COMPLETADO]
        );

        // Cargar artículos y documentos de cada movimiento
        const ids = movements.map(m => m.id);
        let articulos = [];
        let documentos = [];
        if (ids.length > 0) {
            [articulos] = await pool.query(
                'SELECT * FROM articulos WHERE idMovimiento IN (?) ORDER BY id',
                [ids]
            );
            [documentos] = await pool.query(
                'SELECT * FROM documentos WHERE idMovimiento IN (?) ORDER BY id',
                [ids]
            );
        }

        // Adjuntar artículos y documentos a cada movimiento
        const artByMov = {};
        const docByMov = {};
        articulos.forEach(a => {
            if (!artByMov[a.idMovimiento]) artByMov[a.idMovimiento] = [];
            artByMov[a.idMovimiento].push(a);
        });
        documentos.forEach(d => {
            if (!docByMov[d.idMovimiento]) docByMov[d.idMovimiento] = [];
            docByMov[d.idMovimiento].push(d);
        });

        const result = movements.map(m => ({
            ...m,
            articulos: artByMov[m.id] || [],
            documentos: docByMov[m.id] || [],
        }));

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ---------------------------------------------------------------
// @desc  Completar un movimiento desde la portería
// @route PUT /api/porteria/:id/complete
// ---------------------------------------------------------------
exports.completeMovimiento = async (req, res) => {
    const { id } = req.params;
    const { email, horaCompletado, observacionPorteria, vigilador } = req.body;

    if (!email) return res.status(400).json({ error: 'Email requerido' });

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Verificar que el email es de una portería activa
        const [portRows] = await connection.query(
            'SELECT id FROM porterias WHERE email = ? AND activa = 1',
            [email]
        );
        if (portRows.length === 0) {
            return res.status(403).json({ error: 'Esta cuenta no tiene permisos de portería' });
        }

        // Verificar el movimiento
        const [movRows] = await connection.query(
            'SELECT * FROM movimientos WHERE id = ?',
            [id]
        );
        if (movRows.length === 0) return res.status(404).json({ error: 'Movimiento no encontrado' });
        const mov = movRows[0];

        if (mov.idEstado !== ESTADO_PENDIENTE) {
            return res.status(400).json({ error: 'Solo se pueden completar movimientos en estado "Pendiente"' });
        }

        // Construir fechaHoraCompletado: fecha actual + horaCompletado (HH:MM) en horario Argentina
        let fechaHoraCompletado;
        if (horaCompletado) {
            const today = getHoyArgentina(); // YYYY-MM-DD en hora Argentina
            fechaHoraCompletado = `${today} ${horaCompletado}:00`;
        } else {
            fechaHoraCompletado = getNowArgentina(); // Hora actual Argentina
        }

        await connection.query(
            `UPDATE movimientos
             SET idEstado = ?,
                 fechaHoraRegistro = ?,   -- Mantenemos la actualización de fechaHoraRegistro para el orden del historial
                 fechaHoraCompletado = ?, -- Guardamos la hora real de completado
                 observacionPorteria = ?,
                 vigilador = ?,
                 usuario_app = ?
             WHERE id = ?`,
            [ESTADO_COMPLETADO, fechaHoraCompletado, fechaHoraCompletado, observacionPorteria || null, vigilador || null, email, id]
        );

        // Lógica de Autorización Recurrente
        if (mov.esRecurrente === 1 && (mov.idGrupo === 0 || mov.ordenGrupo === 1)) {
            await handleRecurrence(connection, id);
        }

        await connection.commit();
        res.json({ message: 'Movimiento completado correctamente.' });

        // Notificar al autorizante que el movimiento fue procesado en portería
        try {
            const [authEmailRows] = await pool.query(
                `SELECT l.email, l.apellido_nombre AS persona_interna_nombre,
                        aut.email AS autorizante_email,
                        po.nombre AS porteria_nombre
                 FROM movimientos m
                 JOIN legajos l ON l.legajo = m.personaInterna
                 JOIN legajos aut ON aut.legajo = m.personaAutorizante
                 JOIN porterias po ON po.email = ?
                 WHERE m.id = ?`,
                [email, id]
            );
            if (authEmailRows[0]?.autorizante_email) {
                const hora = fechaHoraCompletado.substring(11, 16); // HH:MM
                await notificationService.notifyMovementCompleted(authEmailRows[0].autorizante_email, {
                    id,
                    persona_interna_nombre: authEmailRows[0].persona_interna_nombre,
                    porteria_nombre: authEmailRows[0].porteria_nombre,
                    fecha_completado: hora
                });
            }
        } catch (notifErr) {
            console.error('[Push] Error notificando al autorizante sobre paso en portería:', notifErr);
        }

    } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
};

// ---------------------------------------------------------------
// @desc  Historial de movimientos para la portería (con filtros)
// @route GET /api/porteria/historial?email=&desde=&hasta=&estado=&page=
// ---------------------------------------------------------------
exports.getHistorial = async (req, res) => {
    const { email, desde, hasta, estado, page = 1, persona, autorizante, tipo, motivo, origen, destino } = req.query;
    if (!email) return res.status(400).json({ error: 'Email requerido' });

    const pageSize = 50;
    const offset = (Math.max(1, parseInt(page)) - 1) * pageSize;

    try {
        // 1. Obtener rol del usuario para ver si es Sysadmin
        const [userRows] = await pool.query('SELECT idRol FROM legajos WHERE email = ?', [email]);
        const userRole = userRows.length > 0 ? userRows[0].idRol : 1;

        let whereExtra = ' WHERE 1=1'; // Base WHERE para ir concatenando
        const params = [];

        // 2. Filtro de ubicación (solo si NO es Sysadmin ni RRHH)
        if (userRole < 2) {
            const lugarIds = await getLugaresDePorteria(email);
            if (lugarIds.length === 0) {
                // Si no es portero, no debería ver nada acá
                return res.json({ movements: [], pagination: { total: 0, page: 1, pageSize: 50, totalPages: 0 } });
            }
            // Ve movimientos según dirección: saliente en origen, entrante en destino
            whereExtra += ` AND (
                (mt.direccion = 'saliente' AND m.idLugarOrigen IN (${lugarIds.join(',')}))
                OR (mt.direccion = 'entrante' AND m.idLugarDestino IN (${lugarIds.join(',')}))
            )`;
        }

        // Filtro por fechas
        if (desde) { whereExtra += ' AND DATE(m.fechaHoraRegistro) >= ?'; params.push(desde); }
        if (hasta) { whereExtra += ' AND DATE(m.fechaHoraRegistro) <= ?'; params.push(hasta); }

        if (estado && estado !== 'todos') {
            whereExtra += ' AND m.idEstado = ?';
            params.push(parseInt(estado));
        }
        if (persona) {
            whereExtra += ' AND (lp.apellido_nombre LIKE ? OR m.idPersonaExterna LIKE ?)';
            params.push(`%${persona}%`, `%${persona}%`);
        }
        if (autorizante) {
            whereExtra += ' AND le.apellido_nombre LIKE ?';
            params.push(`%${autorizante}%`);
        }
        if (tipo) {
            whereExtra += ' AND mt.nombre LIKE ?';
            params.push(`%${tipo}%`);
        }
        if (motivo) {
            whereExtra += ' AND m.motivo LIKE ?';
            params.push(`%${motivo}%`);
        }
        if (origen) {
            whereExtra += ' AND lo.nombre LIKE ?';
            params.push(`%${origen}%`);
        }
        if (destino) {
            whereExtra += ' AND ld.nombre LIKE ?';
            params.push(`%${destino}%`);
        }

        const baseWhere = whereExtra;
        const baseParams = params;

        const baseJoins = `
             FROM movimientos m
             JOIN movimientoTipos   mt ON m.idTipo    = mt.id
             JOIN movimientoEstados me ON m.idEstado  = me.id
             JOIN lugares           lo ON m.idLugarOrigen  = lo.id
             JOIN lugares           ld ON m.idLugarDestino = ld.id
             LEFT JOIN legajos      lp ON m.personaInterna    = lp.legajo
             LEFT JOIN legajos      le ON m.personaAutorizante = le.legajo
        `;

        const [[{ total }]] = await pool.query(
            `SELECT COUNT(*) as total
             ${baseJoins}
             ${baseWhere}`,
            baseParams
        );

        const [rows] = await pool.query(
            `SELECT m.*,
                    mt.nombre AS tipo_nombre,
                    me.nombre AS estado_nombre,
                    lo.nombre AS origen_nombre,
                    ld.nombre AS destino_nombre,
                    lp.apellido_nombre AS persona_interna_nombre,
                    le.apellido_nombre AS autorizante_nombre
             ${baseJoins}
             ${baseWhere}
             ORDER BY 
                CASE WHEN m.idEstado = 1 AND DATE(m.fechaHoraRegistro) >= CURDATE() THEN 0 ELSE 1 END,
                m.fechaHoraRegistro DESC
             LIMIT ? OFFSET ?`,
            [...baseParams, pageSize, offset]
        );

        res.json({
            movements: rows,
            pagination: {
                total,
                page: parseInt(page),
                pageSize,
                totalPages: Math.ceil(total / pageSize),
            },
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ---------------------------------------------------------------
// @desc  Corregir la hora de un movimiento ya completado
// @route PUT /api/porteria/:id/update-time
// ---------------------------------------------------------------
exports.updateTime = async (req, res) => {
    const { id } = req.params;
    const { email, nuevaHora } = req.body;

    if (!email || !nuevaHora) return res.status(400).json({ error: 'Email y nueva hora requeridos' });

    try {
        // Verificar rol del usuario (solo Sysadmin, RRHH o Porteros pueden corregir)
        const [userRows] = await pool.query('SELECT idRol FROM legajos WHERE email = ?', [email]);
        const userRole = userRows.length > 0 ? userRows[0].idRol : 1;

        // Si no es admin/rrhh (rol >= 2), verificar si es portero
        if (userRole < 2) {
            const [portRows] = await pool.query(
                'SELECT id FROM porterias WHERE email = ? AND activa = 1',
                [email]
            );
            if (portRows.length === 0) {
                return res.status(403).json({ error: 'No tenés permisos para realizar esta acción' });
            }
        }

        // Obtener el movimiento
        const [movRows] = await pool.query('SELECT fechaHoraCompletado FROM movimientos WHERE id = ?', [id]);
        if (movRows.length === 0) return res.status(404).json({ error: 'Movimiento no encontrado' });

        const mov = movRows[0];
        if (!mov.fechaHoraCompletado) {
            return res.status(400).json({ error: 'El movimiento no está completado en el sistema' });
        }

        // Extraer la fecha (YYYY-MM-DD) del actual fechaHoraCompletado
        // Usar substr si es un string o convertirlo si es un objeto Date
        let fecha;
        if (mov.fechaHoraCompletado instanceof Date) {
            fecha = mov.fechaHoraCompletado.toISOString().slice(0, 10);
        } else {
            fecha = String(mov.fechaHoraCompletado).substring(0, 10);
        }

        const nuevaFechaHora = `${fecha} ${nuevaHora}:00`;

        await pool.query(
            `UPDATE movimientos 
             SET fechaHoraCompletado = ?, 
                 fechaHoraRegistro = ? 
             WHERE id = ?`,
            [nuevaFechaHora, nuevaFechaHora, id]
        );

        res.json({ message: 'Hora corregida correctamente', nuevaFechaHora });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// ---------------------------------------------------------------
// @desc  Validar QR y completar movimiento
// @route POST /api/porteria/scan-qr
// ---------------------------------------------------------------
exports.scanQR = async (req, res) => {
    const { qrData, email, vigilador } = req.body;
    if (!qrData || !email) return res.status(400).json({ error: 'Datos de escaneo incompletos' });

    try {
        if (process.env.ENABLE_QR === 'false') {
            return res.status(403).json({ error: 'El uso de códigos QR está deshabilitado temporalmente.' });
        }
        const secret = process.env.QR_SECRET || 'dy_internal_secret_key_2026_qr';
        
        let id;
        try {
            // Desencriptar el QR (formato esperado: id:hash)
            const parts = qrData.split(':');
            if (parts.length !== 2) throw new Error('Formato inválido');
            
            id = parts[0];
            const receivedHash = parts[1];
            
            const expectedHash = crypto.createHmac('sha256', secret)
                .update(id.toString())
                .digest('hex')
                .substring(0, 10);
                
            if (receivedHash !== expectedHash) {
                return res.status(403).json({ error: 'Código QR inválido o manipulado' });
            }
        } catch (e) {
            return res.status(400).json({ error: 'No se pudo leer el código QR' });
        }

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // 1. Verificar portería
            const [portRows] = await connection.query(
                'SELECT id FROM porterias WHERE email = ? AND activa = 1',
                [email]
            );
            if (portRows.length === 0) {
                return res.status(403).json({ error: 'Esta cuenta no tiene permisos de portería' });
            }

            // 2. Verificar movimiento (debe estar PENDIENTE y SER HOY)
            const [movRows] = await connection.query(
                `SELECT * FROM movimientos 
                 WHERE id = ? AND idEstado = ? AND DATE(fechaHoraRegistro) = ?`,
                [id, ESTADO_PENDIENTE, getHoyArgentina()]
            );

            if (movRows.length === 0) {
                return res.status(404).json({ error: 'La autorización no es válida para hoy o ya fue procesada' });
            }

            const now = getNowArgentina();
            await connection.query(
                `UPDATE movimientos
                 SET idEstado = ?,
                     fechaHoraRegistro = ?,
                     fechaHoraCompletado = ?,
                     observacionPorteria = CONCAT(COALESCE(observacionPorteria, ''), ' [Completado vía QR]'),
                     vigilador = ?,
                     usuario_app = ?
                 WHERE id = ?`,
                [ESTADO_COMPLETADO, now, now, vigilador || 'SISTEMA QR', email, id]
            );

            // Lógica de Autorización Recurrente
            if (movRows[0].esRecurrente === 1 && (movRows[0].idGrupo === 0 || movRows[0].ordenGrupo === 1)) {
                await handleRecurrence(connection, id);
            }

            await connection.commit();
            
            const requiereFichaje = movRows[0].motivo?.toLowerCase() !== 'requerimiento laboral';
            
            res.json({ 
                message: 'Autorización procesada correctamente vía QR', 
                id, 
                requiereFichaje 
            });

            // Notificar al autorizante que el movimiento fue procesado vía QR
            try {
                const mov = movRows[0];
                const [authEmailRows] = await pool.query(
                    `SELECT l.apellido_nombre AS persona_interna_nombre,
                            aut.email AS autorizante_email,
                            po.nombre AS porteria_nombre
                     FROM legajos l
                     JOIN legajos aut ON aut.legajo = ?
                     JOIN porterias po ON po.email = ?
                     WHERE l.legajo = ?`,
                    [mov.personaAutorizante, email, mov.personaInterna]
                );
                if (authEmailRows[0]?.autorizante_email) {
                    const hora = getNowArgentina().substring(11, 16); // HH:MM
                    await notificationService.notifyMovementCompleted(authEmailRows[0].autorizante_email, {
                        id,
                        persona_interna_nombre: authEmailRows[0].persona_interna_nombre,
                        porteria_nombre: authEmailRows[0].porteria_nombre,
                        fecha_completado: hora
                    });
                }
            } catch (notifErr) {
                console.error('[Push] Error notificando al autorizante sobre paso QR en portería:', notifErr);
            }

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ---------------------------------------------------------------
// Helper: Manejar la creación automática de autorizaciones recurrentes
// ---------------------------------------------------------------
async function handleRecurrence(connection, movId) {
    try {
        console.log(`[RECURRENCIA] Procesando para ID: ${movId}`);
        // 1. Obtener datos del movimiento original
        const [movRows] = await connection.query('SELECT * FROM movimientos WHERE id = ?', [movId]);
        const mov = movRows[0];
        if (!mov) {
            console.error(`[RECURRENCIA] No se encontró el movimiento original ${movId}`);
            return;
        }

        // 2. Calcular nueva fecha (mañana)
        const originalDate = mov.fechaHoraRegistro instanceof Date ? mov.fechaHoraRegistro : new Date(mov.fechaHoraRegistro);
        const nextDate = new Date(originalDate);
        nextDate.setDate(nextDate.getDate() + 1);
        
        // Verificar vencimiento (si existe)
        if (mov.vencimientoRecurrencias) {
            const nextDateZero = new Date(nextDate);
            nextDateZero.setHours(0, 0, 0, 0);
            const vencimientoZero = new Date(mov.vencimientoRecurrencias);
            vencimientoZero.setHours(0, 0, 0, 0);
            
            if (nextDateZero > vencimientoZero) {
                console.log(`[RECURRENCIA] Límite alcanzado (${mov.vencimientoRecurrencias}). No se generará nueva serie.`);
                return;
            }
        }

        const nextDateStr = nextDate.toISOString().slice(0, 10) + ' 00:00:00';

        // 3. Clonar movimiento base (Se clona como PENDIENTE para el día siguiente)
        const [result] = await connection.query(
            `INSERT INTO movimientos 
            (idGrupo, ordenGrupo, idTipo, personaInterna, idPersonaExterna, fechaHoraRegistro, conRegreso, motivo, personaAutorizante, observacion, idEstado, idLugarOrigen, idLugarDestino, destinoDetalle, usuario_app, esRecurrente, vencimientoRecurrencias) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                0, 1, 
                mov.idTipo, mov.personaInterna, mov.idPersonaExterna, nextDateStr, mov.conRegreso, mov.motivo, mov.personaAutorizante, 
                mov.observacion ? `[RECURRENTE] ${mov.observacion}` : '[RECURRENTE]', 
                1, // ESTADO_PENDIENTE (ya autorizada)
                mov.idLugarOrigen, mov.idLugarDestino, mov.destinoDetalle, mov.usuario_app, 1,
                mov.vencimientoRecurrencias || null
            ]
        );
        const newId = result.insertId;

        // 4. Clonar artículos
        const [artRows] = await connection.query('SELECT * FROM articulos WHERE idMovimiento = ?', [movId]);
        for (const art of artRows) {
            await connection.query(
                `INSERT INTO articulos 
                (idMovimiento, descripcion, cantidad, idEstado, idLugarOrigen, idLugarDestino, remitente, destinatario, sinRetorno, presentacion, observacion, usuario_app) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [newId, art.descripcion, art.cantidad, 1, art.idLugarOrigen, art.idLugarDestino, art.remitente, art.destinatario, art.sinRetorno, art.presentacion, art.observacion, art.usuario_app]
            );
        }

        // 5. Clonar documentos
        const [docRows] = await connection.query('SELECT * FROM documentos WHERE idMovimiento = ?', [movId]);
        for (const doc of docRows) {
            await connection.query(
                `INSERT INTO documentos 
                (idMovimiento, descripcion, cantidad, idEstado, tipo, idLugarOrigen, idLugarDestino, remitente, destinatario, sinRetorno, observacion, usuario_app) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [newId, doc.descripcion, doc.cantidad, 1, doc.tipo, doc.idLugarOrigen, doc.idLugarDestino, doc.remitente, doc.destinatario, doc.sinRetorno, doc.observacion, doc.usuario_app]
            );
        }

        // 6. Si conRegreso = 1, generar el ciclo completo para el nuevo día
        if (mov.conRegreso) {
            console.log(`[RECURRENCIA] Generando derivados para nuevo ID: ${newId}`);
            await connection.query('CALL sp_GenerarMovimientosDerivados(?)', [newId]);
        }
        
        console.log(`[RECURRENCIA] Nueva serie generada con ID: ${newId} para la fecha: ${nextDateStr}`);
    } catch (err) {
        console.error('[RECURRENCIA] Error clonando movimiento:', err);
        // No lanzamos el error para no trabar el proceso de portería, pero se loguea.
    }
}
