const express = require('express');
const router = express.Router();
const {
  reportarAveria,
  misAverias,
  listarAverias,
  actualizarAveria,
} = require('../controller/averiaController.js');
const { verificarToken } = require('../middleware/authMiddleware.js');
const { verificarRol } = require('../middleware/rolemiddleware.js');

// Cualquier usuario autenticado puede reportar y ver sus propias averías
router.post('/', verificarToken, reportarAveria);
router.get('/mis-averias', verificarToken, misAverias);

// El fontanero (único) ve todas las averías y actualiza su estado
router.get('/', verificarToken, verificarRol('fontanero', 'administrador'), listarAverias);
router.put('/:id', verificarToken, verificarRol('fontanero', 'administrador'), actualizarAveria);

module.exports = router;
