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

app.use(cors());
app.use(express.json());

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

app.listen(PORT, () => {
  console.log(`Servidor corriendo y conectado a Supabase 🚀✅✅
    http://localhost:${PORT}`);
});