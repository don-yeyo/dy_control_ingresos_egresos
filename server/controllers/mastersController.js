const pool = require('../config/db');

// @desc    Get all legajos (paginated)
// @route   GET /api/masters/legajos?page=&search=
exports.getLegajos = async (req, res) => {
    const { page = 1, search = '', limit, activeOnly } = req.query;
    const pageSize = limit ? parseInt(limit) : (parseInt(process.env.PAGE_SIZE_LEGAJOS) || 50);
    const offset = (Math.max(1, parseInt(page)) - 1) * pageSize;

    try {
        let sql = 'SELECT id, legajo, apellido_nombre, email, esAutorizador, idRol, estado FROM legajos';
        let countSql = 'SELECT COUNT(*) as total FROM legajos';
        const params = [];
        const countParams = [];
        const conditions = [];

        if (search) {
            const searchPattern = `%${search}%`;
            conditions.push('(legajo LIKE ? OR apellido_nombre LIKE ? OR email LIKE ?)');
            params.push(searchPattern, searchPattern, searchPattern);
            countParams.push(searchPattern, searchPattern, searchPattern);
        }

        if (activeOnly === 'true') {
            conditions.push('estado = 1');
        }

        if (conditions.length > 0) {
            const whereClause = ' WHERE ' + conditions.join(' AND ');
            sql += whereClause;
            countSql += whereClause;
        }

        sql += ' ORDER BY apellido_nombre LIMIT ? OFFSET ?';
        params.push(pageSize, offset);

        const [rows] = await pool.query(sql, params);
        const [[{ total }]] = await pool.query(countSql, countParams);

        res.json({
            data: rows,
            pagination: {
                total,
                pageSize,
                page: parseInt(page),
                totalPages: Math.ceil(total / pageSize)
            }
        });
    } catch (error) {
        console.error('Error in getLegajos:', error);
        res.status(500).json({ error: error.message });
    }
};

// ... (lugares, movement types, etc.)

// @desc    Create new legajo
// @route   POST /api/masters/legajos
exports.createLegajo = async (req, res) => {
    const { legajo, apellido_nombre, email, idRol, esAutorizador, estado } = req.body;
    
    // Validar campos básicos
    if (!legajo || !apellido_nombre) {
        return res.status(400).json({ error: 'Legajo y Apellido/Nombre son obligatorios' });
    }

    const finalEsAutorizador = (idRol == 2 || idRol == 100) ? 1 : (esAutorizador ? 1 : 0);
    const finalEstado = (estado === undefined) ? 1 : (estado ? 1 : 0);

    try {
        const [result] = await pool.query(
            'INSERT INTO legajos (legajo, apellido_nombre, email, idRol, esAutorizador, estado) VALUES (?, ?, ?, ?, ?, ?)',
            [legajo, apellido_nombre, email || null, idRol || 1, finalEsAutorizador, finalEstado]
        );
        res.json({ id: result.insertId, message: 'Legajo creado correctamente' });
    } catch (error) {
        console.error('Error in createLegajo:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'El número de legajo o email ya existe' });
        }
        res.status(500).json({ error: error.message });
    }
};

// @desc    Update legajo info
// @route   PUT /api/masters/legajos/:id
exports.updateLegajo = async (req, res) => {
    const { id } = req.params; // Usamos el ID autonumérico para mayor seguridad
    const { legajo, apellido_nombre, email, idRol, esAutorizador, estado } = req.body;

    const finalEsAutorizador = (idRol == 2 || idRol == 100) ? 1 : (esAutorizador ? 1 : 0);
    const finalEstado = (estado === undefined) ? 1 : (estado ? 1 : 0);

    try {
        await pool.query(
            'UPDATE legajos SET legajo = ?, apellido_nombre = ?, email = ?, idRol = ?, esAutorizador = ?, estado = ? WHERE id = ?',
            [legajo, apellido_nombre, email || null, idRol, finalEsAutorizador, finalEstado, id]
        );
        res.json({ message: 'Legajo actualizado correctamente' });
    } catch (error) {
        console.error('Error in updateLegajo SQL:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            const field = error.sqlMessage?.toLowerCase().includes('email') ? 'email' : 'legajo';
            return res.status(400).json({ error: `El ${field} ya se encuentra registrado en otro usuario.` });
        }
        res.status(500).json({ error: error.message });
    }
};

// @desc    Delete legajo
// @route   DELETE /api/masters/legajos/:id
exports.deleteLegajo = async (req, res) => {
    const { id } = req.params;
    try {
        // Verificar que no tenga movimientos asociados (opcional, dependiendo de la integridad referencial)
        // Por ahora eliminamos directamente (ON DELETE CASCADE si existe, o fallará por FK)
        await pool.query('DELETE FROM legajos WHERE id = ?', [id]);
        res.json({ message: 'Legajo eliminado correctamente' });
    } catch (error) {
        console.error('Error in deleteLegajo:', error);
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(400).json({ error: 'No se puede eliminar el legajo porque tiene movimientos o registros asociados' });
        }
        res.status(500).json({ error: error.message });
    }
};

// @desc    Get all lugares
// @route   GET /api/masters/lugares
exports.getLugares = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, nombre, esDependencia FROM lugares ORDER BY nombre');
        res.json(rows);
    } catch (error) {
        console.error('Error in getLugares:', error);
        res.status(500).json({ error: error.message });
    }
};

// @desc    Get all movement types
// @route   GET /api/masters/movement-types
exports.getMovementTypes = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM movimientoTipos');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// @desc    Get all movement states
// @route   GET /api/masters/movement-states
exports.getMovementStates = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM movimientoEstados');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// @desc    Get all porteros (vigiladores)
// @route   GET /api/masters/porteros
exports.getPorteros = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM porteros ORDER BY descripcion');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// @desc    Get current user legajo info by email
// @route   GET /api/masters/me
exports.getMe = async (req, res) => {
    const { email } = req.query;
    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    try {
        const [rows] = await pool.query(
            'SELECT legajo, apellido_nombre, email, esAutorizador, idRol, estado FROM legajos WHERE email = ?',
            [email]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Legajo not found for this email' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error('Error in getMe:', error);
        res.status(500).json({ error: error.message });
    }
};


