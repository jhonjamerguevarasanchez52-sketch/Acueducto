const supabase = require('../config/supabaseClient');

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

    req.usuario = data.user; // guardamos el usuario autenticado en la petición
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Error validando el token' });
  }
}

module.exports = verificarToken;