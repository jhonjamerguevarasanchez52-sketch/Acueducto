const express = require('express');
const router = express.Router();
const {
  reportarAveria,
  misAverias,
  averiasZona,
  actualizarAveria,
} = require('../controller/averiaController.js');
const { verificarToken } = require('../middleware/authMiddleware.js');
const { verificarRol } = require('../middleware/rolemiddleware.js');

// Cualquier usuario autenticado (usuario final) puede reportar y ver sus propias averías
router.post('/', verificarToken, reportarAveria);
router.get('/mis-averias', verificarToken, misAverias);

// Solo fontanero puede ver averías de su zona y actualizar el estado
router.get('/zona', verificarToken, verificarRol('fontanero'), averiasZona);
router.put('/:id', verificarToken, verificarRol('fontanero'), actualizarAveria);

module.exports = router;