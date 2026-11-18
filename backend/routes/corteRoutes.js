const express = require('express');
const router = express.Router();
const {
  misCortes,
  estadoServicio,
  listarCortes,
  crearCorte,
  reconectar,
  eliminarCorte,
} = require('../controller/corteController');
const {
  misCortesProgramados,
  listarCortesProgramados,
  listarZonas,
  crearCorteProgramado,
  cancelarCorteProgramado,
} = require('../controller/corteProgramadoController');
const { verificarToken } = require('../middleware/authMiddleware');
const { verificarRol } = require('../middleware/roleMiddleware');

// --- Usuario final ---
router.get('/mis-cortes', verificarToken, misCortes);
router.get('/estado', verificarToken, estadoServicio);
router.get('/programados', verificarToken, misCortesProgramados);

// --- Administrador: cortes programados por zona ---
// Las rutas fijas van antes de las que llevan /:id.
router.get('/programados/todos', verificarToken, verificarRol('administrador'), listarCortesProgramados);
router.post('/programados', verificarToken, verificarRol('administrador'), crearCorteProgramado);
router.put('/programados/:id/cancelar', verificarToken, verificarRol('administrador'), cancelarCorteProgramado);
router.get('/zonas', verificarToken, verificarRol('administrador'), listarZonas);

// --- Administrador: cortes individuales ---
router.get('/', verificarToken, verificarRol('administrador'), listarCortes);
router.post('/', verificarToken, verificarRol('administrador'), crearCorte);
router.put('/:id/reconectar', verificarToken, verificarRol('administrador'), reconectar);
router.delete('/:id', verificarToken, verificarRol('administrador'), eliminarCorte);

module.exports = router;
