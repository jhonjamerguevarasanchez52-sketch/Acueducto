const { CAMPOS_EDITABLES_PERFIL, COLUMNAS_PERFIL_PUBLICO } = require('../utils/perfilCampos');
const { errorInesperado, errorConsulta } = require('../utils/httpErrores');

async function verPerfil(req, res) {
  const userId = req.usuario.id;

  try {
    const { data, error } = await req.db
      .from('profiles')
      .select(COLUMNAS_PERFIL_PUBLICO)
      .eq('id', userId)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    return res.status(200).json(data);
  } catch (err) {
    return errorInesperado(res, err);
  }
}

async function editarPerfil(req, res) {
  const userId = req.usuario.id;

  const datosActualizar = {};
  for (const campo of CAMPOS_EDITABLES_PERFIL) {
    if (req.body[campo] !== undefined) {
      datosActualizar[campo] = req.body[campo];
    }
  }

  if (Object.keys(datosActualizar).length === 0) {
    return res.status(400).json({ error: 'No hay campos válidos para actualizar' });
  }

  try {
    const { data, error } = await req.db
      .from('profiles')
      .update(datosActualizar)
      .eq('id', userId)
      .select(COLUMNAS_PERFIL_PUBLICO)
      .single();

    if (error) {
      return errorConsulta(res, error);
    }

    return res.status(200).json({ message: 'Perfil actualizado', perfil: data });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

module.exports = { verPerfil, editarPerfil };
