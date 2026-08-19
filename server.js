require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);

app.get('/', (req, res) => {
  res.send('API del Acueducto Campo Amor funcionando 🚰');
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo ✅🚀 en http://localhost:${PORT}`);
});