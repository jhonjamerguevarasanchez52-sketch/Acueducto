const supabase = require('../config/supabaseClient'); // Cliente normal (respeta RLS): login y validación de tokens
const { getClienteUsuario } = require('../config/supabaseClient'); // Cliente atado al JWT de un usuario
const supabaseAdmin = require('../config/supabaseAdminClient'); // Cliente admin, para la API de administración de Auth

// Operaciones sobre Supabase Auth (tabla auth.users). Devuelven { data, error }.

function signIn(correo, password) {
  return supabase.auth.signInWithPassword({ email: correo, password });
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

module.exports = { signIn, getUserByToken, userClient, createUser, deleteUser, changePassword };
