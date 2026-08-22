const supabase = require('../config/supabaseClient.js');

async function verificarAdmin(req, res, next) {
  const userId = req.usuario.id;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('rol')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return res.status(403).json({ error: 'No se pudo verificar tu rol' });
    }

    if (data.rol !== 'administrador') {
      return res.status(403).json({ error: 'Solo un administrador puede realizar esta acción' });
    }

    next();
  } catch (err) {
    return res.status(500).json({ error: 'Error verificando permisos', detalle: err.message });
  }
}

module.exports = verificarAdmin;