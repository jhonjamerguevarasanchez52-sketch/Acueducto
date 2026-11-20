const authModel = require('../models/authModel');
const profileModel = require('../models/profileModel');


const { extraerCambiosPerfil } = require('../utils/perfilCampos');
const { errorInesperado, errorConsulta } = require('../utils/httpErrores');
const { generarPasswordTemporal } = require('../utils/passwords');
const { enviarCorreo } = require('../config/mailer');
const { notificar } = require('../utils/notificar');
const { escaparHtml } = require('../utils/html');

const { eliminarCuenta, listarCuentasEliminadas, reenviarCorreoArchivo } = require('../services/accountDeletionService');
const { registrarAuditoria } = require('../utils/auditoria');
const { consultarEstadoCuenta } = require('../services/estadoCuentaService');
const { generarCertificados, listarCertificados, descargarCertificado, reenviarCertificado, generarCertificadoPertenencia } = require('../services/pazYSalvoService');

const { normalizarCorreo } = require('../utils/formato');


const ROLES_VALIDOS = ['administrador', 'usuario', 'fontanero'];

// Crear un usuario con contraseña temporal generada automáticamente.
// Pensado para que un administrador dé de alta a alguien sin tener que
// inventarle una contraseña. La cuenta nace verificada (el correo de
// bienvenida ya prueba que el correo es suyo) y la persona puede entrar con
// la contraseña temporal o, más fácil, con un código enviado a su correo.
// Teléfono, dirección, zona y lote son opcionales y se guardan en el mismo paso.
async function crearUsuario(req, res) {
  const correo = normalizarCorreo(req.body.correo);
  const { nombre, apellido } = req.body;
  const rol = req.body.rol || 'usuario';

  if (!correo || !nombre || !apellido) {
    return res.status(400).json({ error: 'Correo, nombre y apellido son obligatorios' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    return res.status(400).json({ error: 'El correo no tiene un formato válido' });
  }

  if (!ROLES_VALIDOS.includes(rol)) {
    return res.status(400).json({ error: 'Rol inválido. Usa: administrador, usuario o fontanero' });
  }

  const { cambios: datosOpcionales, error: errorCampos } = extraerCambiosPerfil(req.body);
  if (errorCampos) return res.status(400).json({ error: errorCampos });

  const passwordTemporal = generarPasswordTemporal();
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

    // El fontanero nace como "usuario" y se asigna después en una sola
    // transacción: si algo falla, el fontanero actual no pierde su rol.
    const { error: profileError } = await profileModel.create({
      ...datosOpcionales,
      id: userId,
      nombre: String(nombre).trim(),
      apellido: String(apellido).trim(),
      correo,
      rol: rol === 'fontanero' ? 'usuario' : rol,
      activo: true,
      is_verified: true,
      debe_cambiar_password: true,
    });

    if (profileError) {
      // Evitamos dejar un usuario huérfano en auth.users sin perfil asociado.
      await authModel.deleteUser(userId).catch(() => {});
      if (profileError.code === '23505') {
        return res.status(409).json({ error: 'Esa cédula ya está asociada a otra cuenta.' });
      }
      return errorConsulta(res, profileError);
    }
    if (rol === 'fontanero') {
      const { data: asignado, error: errorAsignacion } = await profileModel.assignPlumber(userId);
      if (errorAsignacion || !asignado) {
        await authModel.deleteUser(userId).catch(() => {});
        return errorAsignacion
          ? errorConsulta(res, errorAsignacion)
          : res.status(500).json({ error: 'No se pudo asignar el rol de fontanero.' });
      }
    }

    await registrarAuditoria({
      adminId: req.usuario?.id,
      accion: 'usuario_creado',
      tabla: 'profiles',
      registroId: userId,
      detalle: { subject_user_id: userId, correo, nombre: String(nombre).trim(), apellido: String(apellido).trim(), rol },
    });

    let correoEnviado = false;
    try {
      const respuestaCorreo = await enviarCorreo({
        to: correo,
        subject: 'Tu cuenta en Acueducto Campo Amor',
        html: `<p>Hola ${escaparHtml(nombre)},</p>
          <p>El acueducto creó tu cuenta en la aplicación de Acueducto Campo Amor. Para entrar tienes dos opciones:</p>
          <p><strong>1. La más fácil:</strong> en la app toca <em>"Entrar con un código a mi correo"</em>, escribe este correo (${escaparHtml(correo)}) y te enviaremos un código de 6 dígitos. No necesitas recordar contraseñas.</p>
          <p><strong>2. Con contraseña:</strong> usa esta contraseña temporal. La app te pedirá cambiarla la primera vez.</p>
          <h2 style="letter-spacing:2px;">${escaparHtml(passwordTemporal)}</h2>`,
      });
      if (!respuestaCorreo) throw new Error('Brevo no confirmó el envío.');
      correoEnviado = true;
    } catch (mailErr) {
      console.error('Error enviando correo de cuenta creada:', mailErr.message);
    }

    // Además del correo, dejamos un aviso de bienvenida dentro de la app.
    await notificar(
      userId,
      '¡Bienvenido a Acueducto Campo Amor! Aquí puedes ver y pagar tus facturas, reportar averías y recibir avisos del servicio.',
      'general'
    );

    return res.status(201).json({
      message: correoEnviado
        ? 'Usuario creado. Le enviamos por correo cómo entrar a la app.'
        : 'Usuario creado, pero no se pudo enviar el correo. Comparte la contraseña temporal o pídele que entre con "código a mi correo".',
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

  // Igual que con la desactivación: quitarse el rol de administrador a sí
  // mismo podría dejar el panel sin nadie que lo administre.
  if (userId === req.usuario.id && rol !== 'administrador') {
    return res.status(400).json({ error: 'No puedes quitarte tu propio rol de administrador' });
  }

  try {
    const { data: anterior } = await profileModel.getById(userId, { columns: 'id, rol' });

    // El acueducto contempla un único fontanero a la vez: el anterior baja a
    // "usuario" en la misma transacción en que se asigna el nuevo.
    const { data, error } = rol === 'fontanero'
      ? await profileModel.assignPlumber(userId)
      : await profileModel.update(userId, { rol });

    if (error?.code === '23505') {
      return res.status(409).json({
        error: 'Ya existe un fontanero asignado. Actualiza la lista de usuarios e inténtalo de nuevo.',
      });
    }
    if (error && error.code !== 'PGRST116') return errorConsulta(res, error);
    if (error || !data) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    await registrarAuditoria({
      adminId: req.usuario.id,
      accion: 'usuario_rol_cambiado',
      tabla: 'profiles',
      registroId: userId,
      detalle: { subject_user_id: userId, antes: anterior?.rol ?? null, despues: rol },
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

    if (error?.code === '23505') {
      return res.status(409).json({ error: 'Esa cédula ya está asociada a otra cuenta.' });
    }
    if (error) return errorConsulta(res, error);
    if (!data) return res.status(404).json({ error: 'Usuario no encontrado' });

    await registrarAuditoria({
      adminId: req.usuario.id,
      accion: 'usuario_editado',
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

async function generarCertificadoPertenenciaUsuario(req, res) {
  try {
    const resultado = await generarCertificadoPertenencia(req.params.userId);
    await registrarAuditoria({
      adminId: req.usuario.id,
      accion: 'certificado_pertenencia_generado',
      tabla: 'profiles',
      registroId: req.params.userId,
      detalle: { subject_user_id: req.params.userId },
    });
    return res.status(200).json(resultado);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    return errorInesperado(res, err);
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
  generarCertificadoPertenenciaUsuario,
};
