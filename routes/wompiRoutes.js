const express = require('express');
const router = express.Router();
const { webhook, config } = require('../controller/wompiController');

// Wompi llama a este endpoint (sin token): la seguridad es la firma del evento.
router.post('/webhook', webhook);

// Datos públicos para que el frontend inicialice el widget de pago.
router.get('/config', config);

module.exports = router;
