/**
 * Elimina una cuenta de usuario por completo (Auth + fila en "profiles",
 * que se borra en cascada al borrar el usuario de Auth).
 *
 *   node scripts/eliminarUsuario.js <correo>
 *
 * Ejemplo:
 *   node scripts/eliminarUsuario.js fontanero.test@acueducto.com
 */
require('dotenv').config();
const supabaseAdmin = require('../config/supabaseAdminClient');

async function buscarUsuarioAuthPorCorreo(correo) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    const encontrado = data.users.find(
      (u) => (u.email || '').toLowerCase() === correo,
    );
    if (encontrado) return encontrado;
    if (data.users.length < 200) break;
  }
  return null;
}

async function main() {
  const correo = String(process.argv[2] || '').toLowerCase().trim();

  if (!correo) {
    console.error('Uso: node scripts/eliminarUsuario.js <correo>');
    process.exit(1);
  }

  const existente = await buscarUsuarioAuthPorCorreo(correo);
  if (!existente) {
    console.error(`No existe ningún usuario en Auth con el correo "${correo}".`);
    process.exit(1);
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(existente.id);
  if (error) throw error;

  console.log(`Usuario eliminado: ${correo} (${existente.id})`);
}

main().catch((err) => {
  console.error('Falló la eliminación del usuario ❌');
  console.error(err.message || err);
  process.exit(1);
});
