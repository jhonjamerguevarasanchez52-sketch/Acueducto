require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY en el archivo .env');
}

// Cliente administrativo con Service Role Key: ignora RLS.
// Solo debe usarse en operaciones del backend ya protegidas por
// verificarToken + verificarRol('administrador') (o el flujo de registro,
// que corre sin sesión de usuario todavía).
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

module.exports = supabaseAdmin;
