const express = require('express');
const router = express.Router();
const {
  misCortes,
  estadoServicio,
  listarCortes,
  crearCorte,
  reconectar,
} = require('../controller/corteController');
const { verificarToken } = require('../middleware/authMiddleware');
const { verificarRol } = require('../middleware/roleMiddleware');

// --- Usuario final ---
router.get('/mis-cortes', verificarToken, misCortes);
router.get('/estado', verificarToken, estadoServicio);

// --- Administrador ---
router.get('/', verificarToken, verificarRol('administrador'), listarCortes);
router.post('/', verificarToken, verificarRol('administrador'), crearCorte);
router.put('/:id/reconectar', verificarToken, verificarRol('administrador'), reconectar);

module.exports = router;
