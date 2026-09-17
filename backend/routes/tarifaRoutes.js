const express = require('express');
const router = express.Router();
const {
  verTarifas,
  tarifaVigente,
  crearTarifa,
  actualizarTarifa,
  eliminarTarifa,
} = require('../controller/tarifaController');
const { verificarToken } = require('../middleware/authMiddleware');
const { verificarRol } = require('../middleware/roleMiddleware');

// --- Lectura (cualquier usuario autenticado) ---
router.get('/', verificarToken, verTarifas);
router.get('/vigente', verificarToken, tarifaVigente);

// --- Administrador ---
router.post('/', verificarToken, verificarRol('administrador'), crearTarifa);
router.put('/:id', verificarToken, verificarRol('administrador'), actualizarTarifa);
router.delete('/:id', verificarToken, verificarRol('administrador'), eliminarTarifa);

module.exports = router;
