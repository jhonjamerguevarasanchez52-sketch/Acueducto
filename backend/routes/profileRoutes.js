const express = require('express');
const router = express.Router();
const { verPerfil, editarPerfil, eliminarMiCuenta } = require('../controller/profileController');
const { verificarToken } = require('../middleware/authMiddleware');

router.get('/mi-perfil', verificarToken, verPerfil);
router.put('/mi-perfil', verificarToken, editarPerfil);
router.delete('/mi-cuenta', verificarToken, eliminarMiCuenta);

module.exports = router;
