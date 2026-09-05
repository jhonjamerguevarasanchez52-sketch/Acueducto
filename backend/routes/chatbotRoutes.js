const express = require('express');
const router = express.Router();
const { chatearConAsistente } = require('../controller/chatbotController');
// const { verificarToken } = require('../middleware/authMiddleware'); // si aplica

router.post('/', chatearConAsistente);
// o con auth: router.post('/', verificarToken, chatearConAsistente);

module.exports = router;