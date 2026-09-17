const express = require('express');
const router = express.Router();
const {
  misFacturas,
  verFactura,
  listarFacturas,
  crearFactura,
  actualizarFactura,
  eliminarFactura,
} = require('../controller/facturaController');
const { verificarToken } = require('../middleware/authMiddleware');
const { verificarRol } = require('../middleware/roleMiddleware');

// --- Administrador ---
router.get('/todas', verificarToken, verificarRol('administrador'), listarFacturas);
router.post('/', verificarToken, verificarRol('administrador'), crearFactura);
router.put('/:id', verificarToken, verificarRol('administrador'), actualizarFactura);
router.delete('/:id', verificarToken, verificarRol('administrador'), eliminarFactura);

// --- Usuario final ---
router.get('/', verificarToken, misFacturas);
router.get('/:id', verificarToken, verFactura);

module.exports = router;
