require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes.js');
const profileRoutes = require('./routes/profileRoutes.js');
const facturaRoutes = require('./routes/facturaRoutes.js');
const averiaRoutes = require('./routes/averiaRoutes.js');
const pagoRoutes = require('./routes/pagoRoutes.js');
const notificacionRoutes = require('./routes/notificacionRoutes.js');
const tarifaRoutes = require('./routes/tarifaRoutes.js');
const corteRoutes = require('./routes/corteRoutes.js');
const adminRoutes = require('./routes/adminRoutes.js');

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
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});