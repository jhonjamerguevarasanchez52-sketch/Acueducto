require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const { limiteGeneral } = require('./middleware/rateLimit');
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

const app = express();
const PORT = process.env.PORT || 3000;

// Detrás de Railway (u otro proxy) para que el rate-limit lea la IP real.
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

// Healthcheck para Railway / monitoreo
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
  res.status(err.status || 500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
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

module.exports = app;
