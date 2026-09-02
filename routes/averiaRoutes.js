const express = require('express');
const router = express.Router();
const {
  reportarAveria,
  misAverias,
  listarAverias,
  actualizarAveria,
} = require('../controller/averiaController');
const { verificarToken } = require('../middleware/authMiddleware');
const { verificarRol } = require('../middleware/roleMiddleware');

// Cualquier usuario autenticado puede reportar y ver sus propias averías
router.post('/', verificarToken, reportarAveria);
router.get('/mis-averias', verificarToken, misAverias);

// El fontanero (único) ve todas las averías y actualiza su estado
router.get('/', verificarToken, verificarRol('fontanero', 'administrador'), listarAverias);
router.put('/:id', verificarToken, verificarRol('fontanero', 'administrador'), actualizarAveria);

module.exports = router;
