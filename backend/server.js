require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const { limiteGeneral } = require('./middleware/rateLimit');
const { bloquearLenguajeOfensivo } = require('./utils/lenguajeOfensivo');
const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const facturaRoutes = require('./routes/facturaRoutes');
const averiaRoutes = require('./routes/averiaRoutes');
const pagoRoutes = require('./routes/pagoRoutes');
const notificacionRoutes = require('./routes/notificacionRoutes');
const tarifaRoutes = require('./routes/tarifaRoutes');
const corteRoutes = require('./routes/corteRoutes');
const adminRoutes = require('./routes/adminRoutes');
const wompiRoutes = require('./routes/wompiRoutes');
const chatbotRoutes = require('./routes/chatbotRoutes');
const internoRoutes = require('./routes/internoRoutes');
const tareasRoutes = require('./routes/tareasRoutes');


const app = express();
const PORT = process.env.PORT || 3000;
const enProduccion = process.env.NODE_ENV === 'production';

// Validaciones de arranque: fallar rápido y con un mensaje claro en vez de
// dejar la app corriendo con una configuración insegura en producción.
if (enProduccion) {
  if (!process.env.CORS_ORIGIN) {
    throw new Error(
      'CORS_ORIGIN es obligatorio en producción (lista de orígenes separados por coma). ' +
      'Sin esto, la API acepta peticiones de cualquier sitio web.'
    );
  }
  if (!process.env.WOMPI_EVENTS_SECRET) {
    console.warn(
      '[arranque] WOMPI_EVENTS_SECRET no está configurado: todos los webhooks de Wompi serán rechazados.'
    );
  }
  if (!process.env.WOMPI_INTEGRITY_KEY) {
    console.warn(
      '[arranque] WOMPI_INTEGRITY_KEY no está configurado: los pagos con Wompi no podrán firmarse.'
    );
  }
  if (!process.env.CRON_SECRET) {
    console.warn(
      '[arranque] CRON_SECRET no está configurado: la facturación automática, los recordatorios y la limpieza de audios solo correrán a mano.'
    );
  }
}

// Detrás del proxy de Render para que el rate-limit lea la IP real.
app.set('trust proxy', 1);

app.use(helmet());

// CORS: por defecto abierto; si defines CORS_ORIGIN (lista separada por comas)
// se restringe a esos orígenes.
const origenesPermitidos = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : true;
app.use(cors({ origin: origenesPermitidos }));

app.use(express.json({ limit: '1mb' }));
// En Express 5, req.body es undefined si la petición no trae JSON.
// Lo normalizamos a {} para que los controladores no fallen al leerlo.
app.use((req, res, next) => {
  if (req.body == null) req.body = {};
  next();
});
app.use(limiteGeneral);
// Ningún texto escrito por personas (chat, averías, avisos, perfiles...) puede
// llevar groserías ni lenguaje ofensivo o racista.
app.use(bloquearLenguajeOfensivo);

// Healthcheck para Render, pg_cron (mantener despierto) y monitoreo
app.get('/health', (req, res) => res.status(200).json({ status: 'ok', uptime: process.uptime() }));

app.get('/', (req, res) => {
  res.send('API del Acueducto Campo Amor funcionando 🚰');
});

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/facturas', facturaRoutes);
app.use('/api/pagos', pagoRoutes);
app.use('/api/averias', averiaRoutes);
app.use('/api/notificaciones', notificacionRoutes);
app.use('/api/tarifas', tarifaRoutes);
app.use('/api/cortes', corteRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/wompi', wompiRoutes);
app.use('/api/chat', chatbotRoutes);
// Tareas programadas (limpieza de audios); protegidas con CRON_SECRET.
app.use('/api/interno', internoRoutes);
// Facturación, vencimientos y recordatorios diarios (pg_cron o administrador).
app.use('/api/tareas', tareasRoutes);
// 404 para rutas no definidas
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Manejador central de errores
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Error no controlado:', err);
  if (res.headersSent) return next(err);
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido en el cuerpo de la petición' });
  }
  if (err.type === 'entity.too.large') {
    let error = 'El contenido enviado es demasiado grande.';
    if (req.path.startsWith('/api/chat/audio')) error = 'El audio puede durar máximo 60 segundos.';
    else if (/^\/api\/pagos\/[^/]+\/recibo$/.test(req.path)) error = 'El recibo debe pesar máximo 5 MB.';
    return res.status(413).json({ error });
  }
  res.status(err.status || 500).json({ error: 'Error interno del servidor' });
});

const server = app.listen(PORT, () => {
  const entorno = process.env.NODE_ENV || 'development';
  const linea = '─'.repeat(48);

  console.log(linea);
  console.log('  HIDROAPP · API REST del Acueducto Veredal Campo Amor');
  console.log(linea);
  console.log(`  ${'Estado'.padEnd(11)}: servidor iniciado correctamente`);
  console.log(`  ${'Entorno'.padEnd(11)}: ${entorno}`);
  console.log(`  ${'Puerto'.padEnd(11)}: ${PORT}`);
  console.log(`  ${'URL local'.padEnd(11)}: http://localhost:${PORT}`);
  console.log(`  ${'Healthcheck'.padEnd(11)}: http://localhost:${PORT}/health`);
  console.log(`  ${'Iniciado'.padEnd(11)}: ${new Date().toISOString()}`);
  console.log(linea);
});

// Apagado ordenado: Render envía SIGTERM en cada redeploy. Sin esto, las
// peticiones en curso se cortan a mitad de camino en vez de completarse.
function apagarOrdenadamente(señal) {
  console.log(`\n[apagado] Señal ${señal} recibida, cerrando servidor...`);
  server.close(() => {
    console.log('[apagado] Servidor cerrado, no quedan conexiones activas.');
    process.exit(0);
  });
  // Si algo queda colgado, no dejamos el proceso vivo indefinidamente.
  setTimeout(() => {
    console.error('[apagado] Tiempo de espera agotado, forzando salida.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => apagarOrdenadamente('SIGTERM'));
process.on('SIGINT', () => apagarOrdenadamente('SIGINT'));

module.exports = app;
