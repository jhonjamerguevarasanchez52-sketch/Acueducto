const profileModel = require('../models/profileModel');
const {
  CAMPOS_EDITABLES_PERFIL,
  DIAS_LIMITE_EDICION_PERFIL,
  CORREOS_SIN_LIMITE_EDICION,
} = require('../utils/perfilCampos');
const { errorInesperado, errorConsulta } = require('../utils/httpErrores');

const MS_LIMITE_EDICION_PERFIL = DIAS_LIMITE_EDICION_PERFIL * 24 * 60 * 60 * 1000;

async function verPerfil(req, res) {
  const userId = req.usuario.id;

  try {
    const { data, error } = await profileModel.getById(userId, { db: req.db });

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
    // El usuario solo puede editar sus propios datos una vez cada
    // DIAS_LIMITE_EDICION_PERFIL días. Se revisa contra `updated_at`, que
    // solo se sella cuando el cambio lo hace el propio usuario (no cuando lo
    // hace un administrador desde el panel).
    const { data: actual, error: errorActual } = await profileModel.getById(userId, { db: req.db });
    if (errorActual || !actual) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    const correoUsuario = (req.usuario.email || '').toLowerCase();
    const exento = CORREOS_SIN_LIMITE_EDICION.includes(correoUsuario);

    if (!exento && actual.updated_at) {
      const proximaEdicion = new Date(actual.updated_at).getTime() + MS_LIMITE_EDICION_PERFIL;
      if (Date.now() < proximaEdicion) {
        return res.status(429).json({
          error: `Solo puedes editar tus datos una vez cada ${DIAS_LIMITE_EDICION_PERFIL} días.`,
          proximaEdicionDisponible: new Date(proximaEdicion).toISOString(),
        });
      }
    }

    datosActualizar.updated_at = new Date().toISOString();

    const { data, error } = await profileModel.update(userId, datosActualizar, req.db);

    if (error) {
      return errorConsulta(res, error);
    }

    return res.status(200).json({ message: 'Perfil actualizado', perfil: data });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

module.exports = { verPerfil, editarPerfil };
