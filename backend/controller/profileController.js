const profileModel = require('../models/profileModel');
const {
  extraerCambiosPerfil,
  CAMPOS_UBICACION_SERVICIO,
} = require('../utils/perfilCampos');
const { errorInesperado, errorConsulta } = require('../utils/httpErrores');
const { eliminarCuenta } = require('../services/accountDeletionService');
const authModel = require('../models/authModel');
const { segundosDeBloqueo, registrarFallo, registrarExito } = require('../utils/controlIntentos');

const MENSAJE_UBICACION_BLOQUEADA =
  'La dirección, la zona y el número de lote identifican tu servicio. Para cambiarlos, comunícate con el administrador del acueducto.';

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

// El usuario puede corregir libremente su nombre, teléfono y ocupación. La
// ubicación del servicio (dirección, zona, lote) solo puede llenarla si está
// vacía; una vez registrada, la cambia el administrador desde el panel.
async function editarPerfil(req, res) {
  const userId = req.usuario.id;

  const { cambios: datosActualizar, error: errorCampos } = extraerCambiosPerfil(req.body);
  if (errorCampos) return res.status(400).json({ error: errorCampos });

  if ('cedula' in datosActualizar && req.usuario.rol !== 'administrador') {
    return res.status(403).json({ error: 'Solo un administrador puede actualizar la cédula.' });
  }

  if (Object.keys(datosActualizar).length === 0) {
    return res.status(400).json({ error: 'No hay campos válidos para actualizar' });
  }

  try {
    const { data: actual, error: errorActual } = await profileModel.getById(userId, { db: req.db });
    if (errorActual || !actual) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    const esAdministrador = req.usuario.rol === 'administrador';
    let tocaUbicacion = false;
    for (const campo of CAMPOS_UBICACION_SERVICIO) {
      if (!(campo in datosActualizar)) continue;
      const anterior = String(actual[campo] ?? '').trim();
      const nuevo = String(datosActualizar[campo] ?? '').trim();
      if (anterior === nuevo) {
        delete datosActualizar[campo];
        continue;
      }
      if (anterior && !esAdministrador) {
        return res.status(403).json({ error: MENSAJE_UBICACION_BLOQUEADA, campo });
      }
      tocaUbicacion = true;
    }

    if (Object.keys(datosActualizar).length === 0) {
      return res.status(200).json({ message: 'No había cambios por guardar', perfil: actual });
    }

    // La app no tiene permiso de columna sobre la ubicación (ver migración
    // 20261030): cuando el backend ya validó que es un primer registro, la
    // escritura va por el cliente de servicio. El resto usa el JWT del usuario.
    const { data, error } = await profileModel.update(
      userId,
      datosActualizar,
      tocaUbicacion || (esAdministrador && 'cedula' in datosActualizar) ? undefined : req.db,
    );

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
    // Mismo límite de intentos que el login: con una sesión robada no se
    // puede adivinar la contraseña probando aquí sin bloqueo.
    const correo = String(req.usuario.email || '').toLowerCase();
    const bloqueo = await segundosDeBloqueo('eliminar-cuenta', correo);
    if (bloqueo) {
      return res.status(429).json({
        error: `Demasiados intentos fallidos. Vuelve a intentar en ${Math.ceil(bloqueo / 60)} minutos.`,
      });
    }
    const { error: authError } = await authModel.signIn(req.usuario.email, password);
    if (authError) {
      await registrarFallo('eliminar-cuenta', correo);
      return res.status(401).json({ error: 'La contraseña no es correcta.' });
    }
    await registrarExito('eliminar-cuenta', correo);
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
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    return errorInesperado(res, err);
  }
}

module.exports = { verPerfil, editarPerfil, eliminarMiCuenta };
