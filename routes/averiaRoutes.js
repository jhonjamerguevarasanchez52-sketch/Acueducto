const express = require('express');
const router = express.Router();
const {
  reportarAveria,
  misAverias,
  averiasZona,
  actualizarAveria,
} = require('../controller/averiaController');
const verificarToken = require('../middleware/authMiddleware');

router.post('/', verificarToken, reportarAveria);
router.get('/mis-averias', verificarToken, misAverias);
router.get('/zona', verificarToken, averiasZona);
router.put('/:id', verificarToken, actualizarAveria);

module.exports = router;