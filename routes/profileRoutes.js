const express = require('express');
const router = express.Router();
const { verPerfil, editarPerfil } = require('../controller/profileController.js');
const { verificarToken } = require('../middleware/authMiddleware.js');

router.get('/mi-perfil', verificarToken, verPerfil);
router.put('/mi-perfil', verificarToken, editarPerfil);

module.exports = router;

