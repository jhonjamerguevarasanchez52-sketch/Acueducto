const profileModel = require('../models/profileModel');
const {
  extraerCambiosPerfil,
  DIAS_LIMITE_EDICION_PERFIL,
  CORREOS_SIN_LIMITE_EDICION,
  CAMPOS_REQUERIDOS_PERFIL_COMPLETO,
} = require('../utils/perfilCampos');
const { errorInesperado, errorConsulta } = require('../utils/httpErrores');
const { eliminarCuenta } = require('../services/accountDeletionService');
const authModel = require('../models/authModel');

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

  const { cambios: datosActualizar, error: errorCampos } = extraerCambiosPerfil(req.body);
  if (errorCampos) return res.status(400).json({ error: errorCampos });

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
    const esAdministrador = req.usuario.rol === 'administrador';

    const perfilActualIncompleto = CAMPOS_REQUERIDOS_PERFIL_COMPLETO.some((campo) =>
      !String(actual[campo] ?? '').trim()
    );
    if (!esAdministrador && !exento && !perfilActualIncompleto && actual.updated_at) {
      const proximaEdicion = new Date(actual.updated_at).getTime() + MS_LIMITE_EDICION_PERFIL;
      if (Date.now() < proximaEdicion) {
        return res.status(429).json({
          error: `Solo puedes editar tus datos una vez cada ${DIAS_LIMITE_EDICION_PERFIL} días.`,
          proximaEdicionDisponible: new Date(proximaEdicion).toISOString(),
        });
      }
    }

    // updated_at lo sella Postgres mediante un trigger para que un cliente no
    // pueda alterar el límite de edición enviando su propio timestamp.
    const { data, error } = await profileModel.update(userId, datosActualizar, req.db);

    if (error) {
      return errorConsulta(res, error);
    }

    return res.status(200).json({ message: 'Perfil actualizado', perfil: data });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

async function eliminarMiCuenta(req, res) {
  try {
    const password = String(req.body?.passwordActual || '');
    if (!password) return res.status(400).json({ error: 'Confirma tu contraseña para eliminar la cuenta.' });
    const { error: authError } = await authModel.signIn(req.usuario.email, password);
    if (authError) return res.status(401).json({ error: 'La contraseña no es correcta.' });
    const resultado = await eliminarCuenta({
      userId: req.usuario.id,
      actor: req.usuario,
      deletionType: 'usuario',
      exitNote: req.body?.nota,
    });
    if (resultado.notFound) return res.status(404).json({ error: 'Perfil no encontrado' });
    return res.status(200).json({
      message: resultado.emailSent
        ? 'Cuenta eliminada. Se envió un correo con el resumen de facturas pendientes.'
        : 'Cuenta eliminada, pero no se pudo enviar el correo. La administración podrá reintentarlo.',
      ...resultado,
    });
  } catch (err) {
    if (err.statusCode && err.statusCode < 500) return res.status(err.statusCode).json({ error: err.message });
    return errorInesperado(res, err);
  }
}

module.exports = { verPerfil, editarPerfil, eliminarMiCuenta };
