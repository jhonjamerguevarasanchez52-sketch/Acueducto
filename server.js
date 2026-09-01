require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const facturaRoutes = require('./routes/facturaRoutes');
const averiaRoutes = require('./routes/averiaRoutes');
const pagoRoutes = require('./routes/pagoRoutes');
const notificacionRoutes = require('./routes/notificacionRoutes');
const tarifaRoutes = require('./routes/tarifaRoutes');
const corteRoutes = require('./routes/corteRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS: si se define CORS_ORIGIN (lista separada por comas) se restringe a esos
// orígenes; en caso contrario se permite cualquiera (útil en desarrollo).
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : '*';

app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '1mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/facturas', facturaRoutes);
app.use('/api/pagos', pagoRoutes);
app.use('/api/averias', averiaRoutes);
app.use('/api/notificaciones', notificacionRoutes);
app.use('/api/tarifas', tarifaRoutes);
app.use('/api/cortes', corteRoutes);
app.use('/api/admin', adminRoutes);

app.get('/', (req, res) => {
  res.send('API del Acueducto Campo Amor funcionando 🚰');
});

// 404 para rutas no definidas
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Manejador de errores centralizado
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Error no controlado:', err);

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido en el cuerpo de la petición' });
  }

  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {

  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

  console.log(`Servidor corriendo y conectado a Supabase 🚀✅✅
    http://localhost:${PORT}`);
});

