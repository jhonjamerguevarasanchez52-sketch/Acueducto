const authModel = require('../models/authModel');
const profileModel = require('../models/profileModel');

/**
 * Autenticación OPCIONAL.
 *
 * Si la petición trae un token válido en el header Authorization, deja el
 * usuario en req.usuario (igual que verificarToken) y un cliente de Supabase
 * con RLS en req.db. Si no hay token, o el token es inválido/expirado, la
 * petición continúa igualmente como anónima, sin cortar la respuesta.
 *
 * Pensado para rutas que funcionan con o sin sesión y que dan una respuesta
 * más útil cuando saben quién pregunta (por ejemplo el chatbot GOTA, que
 * personaliza sus respuestas con las facturas y averías del usuario).
 */
async function autenticacionOpcional(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];

  try {
    const { data, error } = await authModel.getUserByToken(token);

    if (error || !data.user) {
      return next(); // token inválido: seguimos como anónimo
    }

    req.db = authModel.userClient(token);
    req.token = token;

    const { data: perfil } = await profileModel.getById(data.user.id, {
      columns: 'id, rol, zona, nombre, apellido, activo, is_verified',
      db: req.db,
    });

    // Una cuenta desactivada se trata como anónima: no se le da contexto privado.
    if (perfil && perfil.activo !== false) {
      req.usuario = { ...data.user, ...perfil };
    }

    return next();
  } catch (err) {
    console.error('Error en autenticacionOpcional:', err.message);
    return next();
  }
}

module.exports = { autenticacionOpcional };
