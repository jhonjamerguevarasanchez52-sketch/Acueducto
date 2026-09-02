require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Faltan las variables de entorno SUPABASE_URL y/o SUPABASE_KEY');
}

const commonOptions = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
};

// Cliente anónimo compartido. Úsalo solo para operaciones sin sesión de usuario
// (por ejemplo signUp / signInWithPassword en el flujo de autenticación).
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, commonOptions);

// Crea un cliente ligado al token del usuario para que las políticas RLS
// (auth.uid()) se apliquen correctamente en cada petición.
function getUserClient(accessToken) {
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    ...commonOptions,
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
}

module.exports = { supabase, getUserClient };
