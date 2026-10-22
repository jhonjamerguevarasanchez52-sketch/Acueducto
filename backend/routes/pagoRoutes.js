const express = require('express');
const router = express.Router();
const {
  misPagos,
  cotizacionWompi,
  registrarPago,
  registrarPagoFisicoConRecibo,
  listarPagos,
  listarPagosWompi,
  confirmarPagoManual,
  registrarPagoAdmin,
  eliminarPago,
} = require('../controller/pagoController');
const { verificarToken } = require('../middleware/authMiddleware');
const { verificarRol } = require('../middleware/roleMiddleware');

// --- Administrador ---
// Las rutas fijas (/todos, /wompi, /admin) van antes de las que llevan /:id
router.get('/todos', verificarToken, verificarRol('administrador'), listarPagos);
router.get('/wompi', verificarToken, verificarRol('administrador'), listarPagosWompi);
router.post('/admin', verificarToken, verificarRol('administrador'), registrarPagoAdmin);
router.put('/:id/confirmar', verificarToken, verificarRol('administrador'), confirmarPagoManual);
router.delete('/:id', verificarToken, verificarRol('administrador'), eliminarPago);

// --- Usuario final ---
router.get('/', verificarToken, misPagos);
router.get('/cotizacion-wompi/:facturaId', verificarToken, cotizacionWompi);
router.post('/', verificarToken, registrarPago);
router.post(
  '/:facturaId/recibo',
  verificarToken,
  express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '5mb' }),
  registrarPagoFisicoConRecibo
);

module.exports = router;
