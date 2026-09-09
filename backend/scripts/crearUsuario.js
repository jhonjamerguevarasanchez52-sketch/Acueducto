/**
 * Crea (o repara) una cuenta de usuario directamente, sin pasar por el flujo de
 * registro con código por correo: el usuario queda listo para iniciar sesión.
 *
 *   node scripts/crearUsuario.js <correo> <password> [nombre] [apellido] [rol]
 *
 * Ejemplo:
 *   node scripts/crearUsuario.js persona@correo.com "ClaveSegura*1" Ana Torres usuario
 *
 * - Crea el usuario en Auth con el correo ya confirmado.
 * - Inserta (o actualiza) su fila en "profiles" con is_verified = true y
 *   activo = true, de modo que authController.iniciarSesion lo deje entrar.
 * - Si el correo ya existe en Auth, reutiliza ese id y solo repara el perfil
 *   (y actualiza la contraseña si se pasó una).
 */
require('dotenv').config();
const supabaseAdmin = require('../config/supabaseAdminClient');

const ROLES_VALIDOS = ['administrador', 'usuario', 'fontanero'];

async function buscarUsuarioAuthPorCorreo(correo) {
  // No hay getUserByEmail en la API admin: paginamos hasta encontrarlo.
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
  const password = process.argv[3];
  const nombre = process.argv[4] || 'Usuario';
  const apellido = process.argv[5] || 'Acueducto';
  const rol = process.argv[6] || 'usuario';

  if (!correo || !password) {
    console.error('Uso: node scripts/crearUsuario.js <correo> <password> [nombre] [apellido] [rol]');
    process.exit(1);
  }
  if (String(password).length < 8) {
    console.error('La contraseña debe tener al menos 8 caracteres.');
    process.exit(1);
  }
  if (!ROLES_VALIDOS.includes(rol)) {
    console.error(`Rol inválido "${rol}". Usa uno de: ${ROLES_VALIDOS.join(', ')}`);
    process.exit(1);
  }

  let userId;

  const { data: creado, error: crearError } =
    await supabaseAdmin.auth.admin.createUser({
      email: correo,
      password,
      email_confirm: true,
    });

  if (crearError) {
    const yaExiste = /already been registered|already exists|duplicate/i.test(
      crearError.message,
    );
    if (!yaExiste) throw crearError;

    const existente = await buscarUsuarioAuthPorCorreo(correo);
    if (!existente) {
      throw new Error(
        `El correo ya está registrado en Auth pero no pude localizar su id.`,
      );
    }
    userId = existente.id;
    console.log(`El usuario ya existía en Auth (${userId}). Actualizo su contraseña y reparo el perfil.`);

    const { error: updError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password, email_confirm: true },
    );
    if (updError) throw updError;
  } else {
    userId = creado.user.id;
    console.log(`Usuario creado en Auth: ${userId}`);
  }

  const perfil = {
    id: userId,
    nombre,
    apellido,
    correo,
    rol,
    activo: true,
    is_verified: true,
    codigo_verificacion: null,
    codigo_verificacion_expiracion: null,
  };

  const { error: perfilError } = await supabaseAdmin
    .from('profiles')
    .upsert(perfil, { onConflict: 'id' });

  if (perfilError) throw perfilError;

  console.log('Perfil listo en "profiles" (is_verified = true, activo = true).');
  console.log('---');
  console.log('Correo   :', correo);
  console.log('Password :', password);
  console.log('Rol      :', rol);
  console.log('Ya puede iniciar sesión en la app.');
}

main().catch((err) => {
  console.error('Falló la creación del usuario ❌');
  console.error(err.message || err);
  process.exit(1);
});
