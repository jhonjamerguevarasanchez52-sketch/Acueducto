const express = require('express');
const router = express.Router();
const {
  misPagos,
  registrarPago,
  listarPagos,
  confirmarPagoManual,
} = require('../controller/pagoController');
const { verificarToken } = require('../middleware/authMiddleware');
const { verificarRol } = require('../middleware/roleMiddleware');

// --- Administrador ---
router.get('/todos', verificarToken, verificarRol('administrador'), listarPagos);
router.put('/:id/confirmar', verificarToken, verificarRol('administrador'), confirmarPagoManual);

// --- Usuario final ---
router.get('/', verificarToken, misPagos);
router.post('/', verificarToken, registrarPago);

module.exports = router;
