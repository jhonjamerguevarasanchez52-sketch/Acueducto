const express = require('express');
const router = express.Router();
const {
  reportarAveria,
  misAverias,
  listarAverias,
  actualizarAveria,
  eliminarAveria,
} = require('../controller/averiaController');
const { verificarToken } = require('../middleware/authMiddleware');
const { verificarRol } = require('../middleware/roleMiddleware');

// Cualquier usuario autenticado puede reportar y ver sus propias averías
router.post('/', verificarToken, verificarRol('usuario', 'administrador'), reportarAveria);
router.get('/mis-averias', verificarToken, misAverias);

// Administración y fontanería consultan la lista global; solo administración elimina reportes.
router.get('/', verificarToken, verificarRol('administrador', 'fontanero'), listarAverias);
// Solo el fontanero cambia el estado de una avería (ni el usuario ni el administrador).
router.put('/:id', verificarToken, verificarRol('fontanero'), actualizarAveria);
router.delete('/:id', verificarToken, verificarRol('administrador'), eliminarAveria);

module.exports = router;
