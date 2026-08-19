const express = require('express');
const router = express.Router();
const { registrar, iniciarSesion } = require('../controller/authController');

router.post('/registro', registrar);
router.post('/login', iniciarSesion);

module.exports = router;