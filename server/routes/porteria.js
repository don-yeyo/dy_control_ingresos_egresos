const express = require('express');
const router = express.Router();
const porteriaController = require('../controllers/porteriaController');

// Verificar si el email es de portería
router.get('/check', porteriaController.checkPorteria);

// Movimientos pendientes del día
router.get('/pendientes', porteriaController.getPendientes);

// Completar un movimiento
router.put('/:id/complete', porteriaController.completeMovimiento);

// Validar y completar movimiento vía QR
router.post('/scan-qr', porteriaController.scanQR);

// Historial con filtros y paginación
router.get('/historial', porteriaController.getHistorial);

// Corregir hora de un completado
router.put('/:id/update-time', porteriaController.updateTime);

module.exports = router;
