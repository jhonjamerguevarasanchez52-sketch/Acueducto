const express = require('express');
const router = express.Router();
const { chatearConAsistente } = require('../controller/chatbotController');
const { autenticacionOpcional } = require('../middleware/authOpcional');

// Autenticación opcional: si viene un token válido, GOTA personaliza la
// respuesta con los datos del usuario (facturas, averías); si no, responde
// igual con la información general del acueducto.
router.post('/', autenticacionOpcional, chatearConAsistente);

module.exports = router;
