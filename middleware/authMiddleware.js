const supabase = require('../config/supabaseClient');
const { getClienteUsuario } = require('../config/supabaseClient');

async function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }

    // Cliente de Supabase con el JWT del usuario: RLS se aplica en cada
    // consulta que hagan los controladores a través de req.db.
    req.db = getClienteUsuario(token);
    req.token = token;

    // Traer el perfil (rol, zona, nombre, etc.) desde la tabla profiles
    const { data: perfil, error: errorPerfil } = await req.db
      .from('profiles')
      .select('id, rol, zona, nombre, apellido, activo, is_verified')
      .eq('id', data.user.id)
      .single();

    if (errorPerfil || !perfil) {
      return res.status(404).json({ error: 'Perfil de usuario no encontrado' });
    }

    if (perfil.activo === false) {
      return res.status(403).json({
        error: 'Tu cuenta está desactivada. Contacta al administrador del acueducto.',
      });
    }

    // Combinamos: datos de Auth (id, email, etc.) + datos del perfil (rol, zona, etc.)
    req.usuario = {
      ...data.user,
      ...perfil,
    };

    next();
  } catch (err) {
    console.error('Error en verificarToken:', err.message);
    return res.status(500).json({ error: 'Error validando el token' });
  }
}

module.exports = { verificarToken };
