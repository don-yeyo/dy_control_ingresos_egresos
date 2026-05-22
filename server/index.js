const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Sincronizar la zona horaria de Node con la de la Base de Datos
if (process.env.DB_TIMEZONE) {
    process.env.TZ = process.env.DB_TIMEZONE;
}

const app = express();
const PORT = process.env.PORT || 5001;

// rate-limit: Protección Anti-DOS (Máximo 1000 reqs / IP cada 15 min)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 1000, 
    message: { error: 'Demasiadas solicitudes desde esta IP, por favor intenta en 15 minutos.' }
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));

// Límite de carga útil HTTP de 2MB para evitar bloqueos por memoria (DOS)
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Aplicar rate-limit a todas las rutas de la API
app.use('/api', limiter);

// Routes
const masterRoutes = require('./routes/masters');
const movementRoutes = require('./routes/movements');
const porteriaRoutes = require('./routes/porteria');
const notificationRoutes = require('./routes/notifications');
const supportRoutes = require('./routes/support');
const systemRoutes = require('./routes/system');

app.use('/api/masters', masterRoutes);
app.use('/api/movements', movementRoutes);
app.use('/api/porteria', porteriaRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/system', systemRoutes);

app.get('/', (req, res) => {
    res.json({ message: 'Control de Ingresos y Egresos API' });
});

// Basic error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

if (process.env.NODE_ENV !== 'production' || !process.env.NETLIFY) {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}

module.exports = app;
