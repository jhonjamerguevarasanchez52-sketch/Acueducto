const express = require('express');
const router = express.Router();
const { verPerfil, editarPerfil } = require('../controller/profileController');
const { verificarToken } = require('../middleware/authMiddleware'); // ← con llaves

router.get('/mi-perfil', verificarToken, verPerfil);
router.put('/mi-perfil', verificarToken, editarPerfil);

module.exports = router;