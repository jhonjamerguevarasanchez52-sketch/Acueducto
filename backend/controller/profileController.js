const profileModel = require('../models/profileModel');
const {
  extraerCambiosPerfil,
  CAMPOS_UBICACION_SERVICIO,
} = require('../utils/perfilCampos');
const { errorInesperado, errorConsulta } = require('../utils/httpErrores');

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
      tocaUbicacion ? undefined : req.db,
    );

    if (error) {
      return errorConsulta(res, error);
    }

    return res.status(200).json({ message: 'Perfil actualizado', perfil: data });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

module.exports = { verPerfil, editarPerfil };
