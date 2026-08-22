const supabaseAdmin = require('../config/supabaseAdminClient.js');

async function cambiarRol(req, res) {
  const { userId } = req.params;
  const { rol } = req.body;

  const rolesValidos = ['administrador', 'usuario', 'fontanero'];
  if (!rol || !rolesValidos.includes(rol)) {
    return res.status(400).json({ error: 'Rol inválido. Usa: administrador, usuario o fontanero' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ rol })
      .eq('id', userId)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    return res.status(200).json({ message: `Rol actualizado a "${rol}"`, perfil: data });
  } catch (err) {
    return res.status(500).json({ error: 'Error inesperado', detalle: err.message });
  }
}

async function verTodosUsuarios(req, res) {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Error inesperado', detalle: err.message });
  }
}

module.exports = { cambiarRol, verTodosUsuarios };