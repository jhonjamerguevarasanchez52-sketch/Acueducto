const authModel = require('../models/authModel');
const profileModel = require('../models/profileModel');
const cacheSesiones = require('../utils/cacheSesiones');

const COLUMNAS_PERFIL = 'id, rol, zona, direccion, nombre, apellido, activo, is_verified, debe_cambiar_password';

// Valida el token con Supabase y trae el perfil. El resultado se guarda unos
// segundos en cacheSesiones para no repetir los dos viajes en cada petición.
async function resolverSesion(token, db) {
  const enCache = cacheSesiones.obtener(token);
  if (enCache) return enCache;

  const { data, error } = await authModel.getUserByToken(token);
  if (error || !data?.user) return { estado: 401 };

  const { data: perfil, error: errorPerfil } = await profileModel.getById(data.user.id, {
    columns: COLUMNAS_PERFIL,
    db,
  });
  if (errorPerfil || !perfil) return { estado: 404 };

  const sesion = { user: data.user, perfil };
  cacheSesiones.guardar(token, sesion);
  return sesion;
}

async function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Cliente de Supabase con el JWT del usuario: RLS se aplica en cada
    // consulta que hagan los controladores a través de req.db.
    const db = authModel.userClient(token);
    const sesion = await resolverSesion(token, db);

    if (sesion.estado === 401) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }
    if (sesion.estado === 404) {
      return res.status(404).json({ error: 'Perfil de usuario no encontrado' });
    }

    if (sesion.perfil.activo === false) {
      return res.status(403).json({
        error: 'Tu cuenta está desactivada. Contacta al administrador del acueducto.',
      });
    }

    req.db = db;
    req.token = token;
    // Combinamos: datos de Auth (id, email, etc.) + datos del perfil (rol, zona, etc.)
    req.usuario = {
      ...sesion.user,
      ...sesion.perfil,
    };

    next();
  } catch (err) {
    console.error('Error en verificarToken:', err.message);
    return res.status(500).json({ error: 'Error validando el token' });
  }
}

module.exports = { verificarToken, resolverSesion };
