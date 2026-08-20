require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Cliente especial con permisos elevados — SOLO para operaciones de administrador
// Nunca exponer esta key ni este cliente al frontend
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = supabaseAdmin;