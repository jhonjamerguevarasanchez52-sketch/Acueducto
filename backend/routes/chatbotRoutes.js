const express = require('express');
const router = express.Router();
const { chatearConAsistente, transcribirAudio } = require('../controller/chatbotController');
const { autenticacionOpcional } = require('../middleware/authOpcional');
const { verificarToken } = require('../middleware/authMiddleware');
const { verificarRol } = require('../middleware/roleMiddleware');
const { limiteChat } = require('../middleware/rateLimit');
const { LIMITES, MIME_TYPES } = require('../services/audiosAveriaService');

// Autenticación opcional: si viene un token válido, GOTA personaliza la
// respuesta con los datos del usuario (facturas, averías); si no, responde
// igual con la información general del acueducto.
// El límite va después de la autenticación para contar por usuario.
router.post('/', autenticacionOpcional, limiteChat, chatearConAsistente);

// Los audios cuestan transcripción y almacenamiento: solo con sesión y con
// el mismo rol que puede reportar averías.
router.post(
  '/audio',
  verificarToken,
  limiteChat,
  verificarRol('usuario', 'administrador'),
  express.raw({ type: MIME_TYPES, limit: LIMITES.maxBytes }),
  transcribirAudio
);

module.exports = router;
