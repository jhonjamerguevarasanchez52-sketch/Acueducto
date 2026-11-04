const supabase = require('../config/supabaseClient'); // Cliente normal (respeta RLS): login y validación de tokens
const { getClienteUsuario } = require('../config/supabaseClient'); // Cliente atado al JWT de un usuario
const supabaseAdmin = require('../config/supabaseAdminClient'); // Cliente admin, para la API de administración de Auth

// Operaciones sobre Supabase Auth (tabla auth.users). Devuelven { data, error }.

function signIn(correo, password) {
  return supabase.auth.signInWithPassword({ email: correo, password });
}

function refreshSession(refreshToken) {
  return supabase.auth.refreshSession({ refresh_token: refreshToken });
}

function getUserByToken(token) {
  return supabase.auth.getUser(token);
}

// Cliente de Supabase con el JWT del usuario: aplica RLS en cada consulta.
function userClient(token) {
  return getClienteUsuario(token);
}

function createUser(correo, password) {
  return supabaseAdmin.auth.admin.createUser({ email: correo, password, email_confirm: true });
}

function deleteUser(id) {
  return supabaseAdmin.auth.admin.deleteUser(id);
}

function changePassword(id, password) {
  return supabaseAdmin.auth.admin.updateUserById(id, { password });
}

// Crea una sesión para un correo SIN contraseña. Solo se llama después de que
// el backend validó el código de 6 dígitos que le envió a ese correo
// (authController.ingresarConCodigo). generateLink no envía ningún correo:
// solo devuelve el token, que se canjea de inmediato por la sesión.
async function createSessionForEmail(correo) {
  const { data: enlace, error: errorEnlace } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: correo,
  });
  const tokenHash = enlace?.properties?.hashed_token;
  if (errorEnlace || !tokenHash) {
    return { data: null, error: errorEnlace || new Error('No se pudo generar el acceso.') };
  }
  return supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' });
}

module.exports = {
  signIn,
  refreshSession,
  getUserByToken,
  userClient,
  createUser,
  deleteUser,
  changePassword,
  createSessionForEmail,
};
