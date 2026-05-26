const express = require('express');
const router = express.Router();
const mastersController = require('../controllers/mastersController');

router.get('/legajos', mastersController.getLegajos);
router.post('/legajos', mastersController.createLegajo);
router.put('/legajos/:id', mastersController.updateLegajo);
router.delete('/legajos/:id', mastersController.deleteLegajo);
router.get('/me', mastersController.getMe);
router.get('/lugares', mastersController.getLugares);
router.get('/movement-types', mastersController.getMovementTypes);
router.get('/movement-states', mastersController.getMovementStates);
router.get('/porteros', mastersController.getPorteros);
router.get('/motivos', mastersController.getMotivos);

module.exports = router;
