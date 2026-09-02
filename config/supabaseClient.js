require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Faltan SUPABASE_URL o SUPABASE_KEY en el archivo .env');
}

// Cliente anónimo, sin sesión. Se usa para autenticación (signUp /
// signInWithPassword) y para validar tokens en el middleware.
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Devuelve un cliente de Supabase que actúa EN NOMBRE del usuario dueño
 * del token. Al enviar el JWT en cada consulta, las políticas de Row Level
 * Security se aplican también cuando la petición pasa por el backend, no
 * solo cuando el frontend habla directo con Supabase.
 *
 * @param {string} accessToken JWT de la sesión del usuario
 */
function getClienteUsuario(accessToken) {
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

module.exports = supabase;
module.exports.getClienteUsuario = getClienteUsuario;
