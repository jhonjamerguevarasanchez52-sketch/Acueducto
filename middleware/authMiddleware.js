const { supabase, getUserClient } = require('../config/supabaseClient');
const supabaseAdmin = require('../config/supabaseAdminClient');

async function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }

    // El perfil se consulta con la service key: es una operación de backend
    // de confianza y no debe depender de las políticas RLS.
    const { data: perfil, error: errorPerfil } = await supabaseAdmin
      .from('profiles')
      .select('id, rol, zona, nombre, apellido, activo')
      .eq('id', data.user.id)
      .maybeSingle();

    if (errorPerfil) {
      console.error('Error al consultar el perfil:', errorPerfil.message);
      return res.status(500).json({ error: 'Error validando el perfil' });
    }

    if (!perfil) {
      return res.status(404).json({ error: 'Perfil de usuario no encontrado' });
    }

    if (perfil.activo === false) {
      return res.status(403).json({ error: 'Tu cuenta está desactivada' });
    }

    // Datos de Auth (email, etc.) + datos del perfil (rol, zona, etc.).
    // El perfil va al final para que su id/rol tengan prioridad.
    req.usuario = {
      ...data.user,
      ...perfil,
    };

    // Cliente ligado al token: respeta la RLS en las consultas de datos.
    req.accessToken = token;
    req.supabase = getUserClient(token);

    next();
  } catch (err) {
    console.error('Error en verificarToken:', err.message);
    return res.status(500).json({ error: 'Error validando el token' });
  }
}

module.exports = { verificarToken };
