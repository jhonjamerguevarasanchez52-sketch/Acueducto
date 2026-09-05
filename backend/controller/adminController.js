const supabaseAdmin = require('../config/supabaseAdminClient');
const { CAMPOS_EDITABLES_PERFIL, COLUMNAS_PERFIL_PUBLICO } = require('../utils/perfilCampos');
const { errorInesperado, errorConsulta } = require('../utils/httpErrores');

const ROLES_VALIDOS = ['administrador', 'usuario', 'fontanero'];

// Listar todos los usuarios
async function verTodosUsuarios(req, res) {
  const { rol, activo } = req.query;

  try {
    let query = supabaseAdmin
      .from('profiles')
      .select(COLUMNAS_PERFIL_PUBLICO)
      .order('created_at', { ascending: false });

    if (rol) query = query.eq('rol', rol);
    if (activo === 'true') query = query.eq('activo', true);
    if (activo === 'false') query = query.eq('activo', false);

    const { data, error } = await query;
    if (error) return errorConsulta(res, error);

    return res.status(200).json(data);
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// Ver un usuario concreto
async function verUsuario(req, res) {
  const { userId } = req.params;

  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select(COLUMNAS_PERFIL_PUBLICO)
      .eq('id', userId)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    return res.status(200).json(data);
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// Cambiar el rol de un usuario
async function cambiarRol(req, res) {
  const { userId } = req.params;
  const { rol } = req.body;

  if (!rol || !ROLES_VALIDOS.includes(rol)) {
    return res.status(400).json({ error: 'Rol inválido. Usa: administrador, usuario o fontanero' });
  }

  // El acueducto contempla un único fontanero: si se asigna, se quita al anterior.
  try {
    if (rol === 'fontanero') {
      const { error: errorDegradacion } = await supabaseAdmin
        .from('profiles')
        .update({ rol: 'usuario' })
        .eq('rol', 'fontanero')
        .neq('id', userId);

      if (errorDegradacion) {
        return errorConsulta(res, errorDegradacion);
      }
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ rol })
      .eq('id', userId)
      .select(COLUMNAS_PERFIL_PUBLICO)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    return res.status(200).json({ message: `Rol actualizado a "${rol}"`, perfil: data });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// Editar datos administrativos de un usuario
async function editarUsuario(req, res) {
  const { userId } = req.params;

  const cambios = {};
  for (const campo of CAMPOS_EDITABLES_PERFIL) {
    if (req.body[campo] !== undefined) cambios[campo] = req.body[campo];
  }

  if (Object.keys(cambios).length === 0) {
    return res.status(400).json({ error: 'No hay campos válidos para actualizar' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(cambios)
      .eq('id', userId)
      .select(COLUMNAS_PERFIL_PUBLICO)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    return res.status(200).json({ message: 'Usuario actualizado', perfil: data });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// Activar o desactivar un usuario (bloquea/permite el acceso)
async function cambiarEstadoUsuario(req, res) {
  const { userId } = req.params;
  const { activo } = req.body;

  if (typeof activo !== 'boolean') {
    return res.status(400).json({ error: 'El campo "activo" debe ser true o false' });
  }

  if (userId === req.usuario.id && activo === false) {
    return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ activo })
      .eq('id', userId)
      .select(COLUMNAS_PERFIL_PUBLICO)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    return res.status(200).json({
      message: activo ? 'Usuario activado' : 'Usuario desactivado',
      perfil: data,
    });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

module.exports = {
  verTodosUsuarios,
  verUsuario,
  cambiarRol,
  editarUsuario,
  cambiarEstadoUsuario,
};
