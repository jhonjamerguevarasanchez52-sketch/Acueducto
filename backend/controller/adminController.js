const authModel = require('../models/authModel');
const profileModel = require('../models/profileModel');
const { extraerCambiosPerfil } = require('../utils/perfilCampos');
const { errorInesperado, errorConsulta } = require('../utils/httpErrores');
const { generarPasswordTemporal } = require('../utils/passwords');
const { generarCodigoSeguridad } = require('../utils/securityCode');
const { enviarCorreo } = require('../config/mailer');
const { notificar } = require('../utils/notificar');
const { escaparHtml } = require('../utils/html');
const { eliminarCuenta, listarCuentasEliminadas, reenviarCorreoArchivo } = require('../services/accountDeletionService');
const { registrarAuditoria } = require('../utils/auditoria');
const { consultarEstadoCuenta } = require('../services/estadoCuentaService');
const { generarCertificados, listarCertificados, descargarCertificado, reenviarCertificado } = require('../services/pazYSalvoService');

const ROLES_VALIDOS = ['administrador', 'usuario', 'fontanero'];

function normalizarCorreo(correo) {
  return String(correo || '').toLowerCase().trim();
}

// Crear un usuario con contraseña temporal generada automáticamente.
// Pensado para que un administrador dé de alta a alguien sin tener que
// inventarle una contraseña: se le envía por correo y queda obligado a
// cambiarla apenas inicie sesión (ver authController.iniciarSesion).
async function crearUsuario(req, res) {
  const correo = normalizarCorreo(req.body.correo);
  const { nombre, apellido } = req.body;
  const rol = req.body.rol || 'usuario';

  if (!correo || !nombre || !apellido) {
    return res.status(400).json({ error: 'Correo, nombre y apellido son obligatorios' });
  }

  if (!ROLES_VALIDOS.includes(rol)) {
    return res.status(400).json({ error: 'Rol inválido. Usa: administrador, usuario o fontanero' });
  }

  const passwordTemporal = generarPasswordTemporal();
  const codigoVerificacion = generarCodigoSeguridad();
  const codigoVerificacionExpiracion = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  let userId;

  try {
    const { data: creado, error: crearError } = await authModel.createUser(correo, passwordTemporal);

    if (crearError) {
      const yaExiste = /already been registered|already exists|duplicate/i.test(crearError.message);
      return res.status(yaExiste ? 409 : 400).json({
        error: yaExiste ? 'Ese correo ya está registrado' : crearError.message,
      });
    }

    userId = creado.user.id;

    // El acueducto contempla un único fontanero: si se asigna, se quita al anterior.
    if (rol === 'fontanero') {
      const { error: errorDegradacion } = await profileModel.demotePlumbers();

      if (errorDegradacion) {
        await authModel.deleteUser(userId).catch(() => {});
        return errorConsulta(res, errorDegradacion);
      }
    }

    const { error: profileError } = await profileModel.create({
      id: userId,
      nombre,
      apellido,
      correo,
      rol,
      activo: true,
      is_verified: false,
      debe_cambiar_password: true,
      codigo_verificacion: codigoVerificacion,
      codigo_verificacion_expiracion: codigoVerificacionExpiracion,
    });

    if (profileError) {
      // Evitamos dejar un usuario huérfano en auth.users sin perfil asociado.
      await authModel.deleteUser(userId).catch(() => {});
      return errorConsulta(res, profileError);
    }

    await registrarAuditoria({
      adminId: req.usuario.id,
      accion: 'usuario_creado',
      tabla: 'profiles',
      registroId: userId,
      detalle: { subject_user_id: userId, correo, nombre, apellido, rol },
    });

    let correoEnviado = false;
    try {
      const respuestaCorreo = await enviarCorreo({
        to: correo,
        subject: 'Tu cuenta en Acueducto Campo Amor',
        html: `<p>Hola ${escaparHtml(nombre)},</p>
          <p>Un administrador creó tu cuenta en Acueducto Campo Amor. Esta es tu contraseña temporal:</p>
          <h2>${escaparHtml(passwordTemporal)}</h2>
          <p><strong>Código de verificación:</strong></p>
          <h2>${codigoVerificacion}</h2>
          <p>Por seguridad, deberás cambiarla apenas inicies sesión por primera vez.</p>`,
      });
      if (!respuestaCorreo) throw new Error('Brevo no confirmó el envío.');
      correoEnviado = true;
    } catch (mailErr) {
      console.error('Error enviando correo de cuenta creada:', mailErr.message);
      await profileModel.saveFields(userId, {
        codigo_verificacion: null,
        codigo_verificacion_expiracion: null,
      });
    }

    // Además del correo, dejamos un aviso dentro de la app para cuando inicie sesión.
    await notificar(
      userId,
      'Tu cuenta fue creada con una contraseña temporal. Por seguridad, cámbiala desde tu perfil.',
      'seguridad'
    );

    return res.status(201).json({
      message: correoEnviado
        ? 'Usuario creado. Se enviaron la contraseña temporal y el código de verificación por correo.'
        : 'Usuario creado, pero no se pudo enviar el correo. Comparte la contraseña temporal y solicita el reenvío del código desde el inicio de sesión.',
      userId,
      correoEnviado,
      // Se devuelve también aquí (solo visible para el administrador que crea
      // la cuenta) por si el envío de correo falla y hay que compartirla a mano.
      passwordTemporal,
    });
  } catch (err) {
    if (userId) {
      await authModel.deleteUser(userId).catch(() => {});
    }
    return errorInesperado(res, err);
  }
}

// Listar todos los usuarios
async function verTodosUsuarios(req, res) {
  const { rol, activo, limit, offset } = req.query;

  try {
    const { data, error } = await profileModel.list({ rol, activo, limit, offset });
    if (error) return errorConsulta(res, error);
    const estados = await consultarEstadoCuenta((data || []).map((perfil) => perfil.id));
    return res.status(200).json((data || []).map((perfil) => {
      const estado = estados.get(perfil.id) || { saldoPendiente: 0, facturasPendientes: [], estadoCuenta: 'al_dia' };
      return {
        ...perfil,
        estado_cuenta: estado.estadoCuenta,
        saldo_pendiente: estado.saldoPendiente,
        facturas_pendientes: estado.facturasPendientes,
      };
    }));
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// Ver un usuario concreto
async function verUsuario(req, res) {
  const { userId } = req.params;

  try {
    const { data, error } = await profileModel.getById(userId);

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

  // El acueducto contempla un único fontanero a la vez: si ya hay uno asignado
  // a otro usuario, hay que quitarle el rol (o eliminarlo) antes de asignar uno nuevo.
  try {
    if (rol === 'fontanero') {
      const { error: errorDegradacion } = await profileModel.demotePlumbers(userId);

      if (errorDegradacion) {
        return errorConsulta(res, errorDegradacion);
      }
    }

    const { data, error } = await profileModel.update(userId, { rol });

    if (error?.code === '23505') {
      return res.status(409).json({
        error: 'Ya existe un fontanero asignado. Actualiza la lista de usuarios e inténtalo de nuevo.',
      });
    }
    if (error || !data) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    await registrarAuditoria({
      adminId: req.usuario.id,
      accion: 'rol_actualizado',
      tabla: 'profiles',
      registroId: userId,
      detalle: { subject_user_id: userId, nuevo_rol: rol },
    });

    return res.status(200).json({ message: `Rol actualizado a "${rol}"`, perfil: data });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// Editar datos administrativos de un usuario
async function editarUsuario(req, res) {
  const { userId } = req.params;

  const { cambios, error: errorCampos } = extraerCambiosPerfil(req.body);
  if (errorCampos) return res.status(400).json({ error: errorCampos });

  if (Object.keys(cambios).length === 0) {
    return res.status(400).json({ error: 'No hay campos válidos para actualizar' });
  }

  try {
    const { data, error } = await profileModel.update(userId, cambios);

    if (error || !data) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    await registrarAuditoria({
      adminId: req.usuario.id,
      accion: 'perfil_usuario_editado',
      tabla: 'profiles',
      registroId: userId,
      detalle: { subject_user_id: userId, campos: Object.keys(cambios) },
    });

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
    const { data, error } = await profileModel.update(userId, { activo });

    if (error || !data) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    await registrarAuditoria({
      adminId: req.usuario.id,
      accion: activo ? 'usuario_activado' : 'usuario_desactivado',
      tabla: 'profiles',
      registroId: userId,
      detalle: { subject_user_id: userId, activo },
    });

    return res.status(200).json({
      message: activo ? 'Usuario activado' : 'Usuario desactivado',
      perfil: data,
    });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// Archiva el historial y notifica el correo antes de completar la baja de Auth.
async function eliminarUsuario(req, res) {
  const { userId } = req.params;
  try {
    const resultado = await eliminarCuenta({
      userId,
      actor: req.usuario,
      deletionType: 'administrador',
      exitNote: req.body?.nota,
    });
    if (resultado.notFound) return res.status(404).json({ error: 'Usuario no encontrado' });
    return res.status(200).json({
      message: resultado.emailSent
        ? 'Perfil archivado y eliminado. Se envió el correo de confirmación.'
        : 'Perfil archivado y eliminado; el correo falló y quedó disponible para reintento.',
      ...resultado,
    });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    return errorInesperado(res, err);
  }
}

async function verUsuariosEliminados(req, res) {
  try {
    const { data, error } = await listarCuentasEliminadas();
    if (error) return errorConsulta(res, error);
    return res.status(200).json(data || []);
  } catch (err) {
    return errorInesperado(res, err);
  }
}

async function reenviarAvisoEliminacion(req, res) {
  try {
    const resultado = await reenviarCorreoArchivo(req.params.archiveId);
    return res.status(200).json({ message: `Aviso enviado a ${resultado.email}` });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

async function generarPazYSalvo(req, res) {
  try {
    const resultado = await generarCertificados({
      perfilIds: req.body?.perfil_ids,
      enviar: req.body?.enviar_correo === true,
      actor: req.usuario,
    });
    return res.status(200).json(resultado);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    return errorInesperado(res, err);
  }
}

async function verPazYSalvos(req, res) {
  try {
    const { data, error } = await listarCertificados();
    if (error) return errorConsulta(res, error);
    return res.status(200).json(data || []);
  } catch (err) {
    return errorInesperado(res, err);
  }
}

async function descargarPazYSalvo(req, res) {
  try {
    const resultado = await descargarCertificado(req.params.certificateId);
    return res.status(200).json(resultado);
  } catch (err) {
    return errorInesperado(res, err);
  }
}

async function reenviarPazYSalvo(req, res) {
  try {
    const resultado = await reenviarCertificado(req.params.certificateId);
    return res.status(200).json({ message: `Certificado reenviado a ${resultado.email}` });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

module.exports = {
  crearUsuario,
  verTodosUsuarios,
  verUsuario,
  cambiarRol,
  editarUsuario,
  cambiarEstadoUsuario,
  eliminarUsuario,
  verUsuariosEliminados,
  reenviarAvisoEliminacion,
  generarPazYSalvo,
  verPazYSalvos,
  descargarPazYSalvo,
  reenviarPazYSalvo,
};
