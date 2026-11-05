const authModel = require('../models/authModel');
const profileModel = require('../models/profileModel');
const breakdownModel = require('../models/breakdownModel');
const supabaseAdmin = require('../config/supabaseAdminClient');
const { extraerCambiosPerfil } = require('../utils/perfilCampos');
const { errorInesperado, errorConsulta } = require('../utils/httpErrores');
const { generarPasswordTemporal } = require('../utils/passwords');
const { enviarCorreo } = require('../config/mailer');
const { notificar } = require('../utils/notificar');
const { escaparHtml } = require('../utils/html');
const { normalizarCorreo } = require('../utils/formato');
const cacheSesiones = require('../utils/cacheSesiones');

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

    // El acueducto contempla un único fontanero: si se asigna, se quita al anterior.
    if (rol === 'fontanero') {
      const { error: errorDegradacion } = await profileModel.demotePlumbers();

      if (errorDegradacion) {
        await authModel.deleteUser(userId).catch(() => {});
        return errorConsulta(res, errorDegradacion);
      }
    }

    const { error: profileError } = await profileModel.create({
      ...datosOpcionales,
      id: userId,
      nombre: String(nombre).trim(),
      apellido: String(apellido).trim(),
      correo,
      rol,
      activo: true,
      is_verified: true,
      debe_cambiar_password: true,
    });

    if (profileError) {
      // Evitamos dejar un usuario huérfano en auth.users sin perfil asociado.
      await authModel.deleteUser(userId).catch(() => {});
      return errorConsulta(res, profileError);
    }

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

    return res.status(200).json(data);
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

  // El acueducto contempla un único fontanero a la vez: si ya hay uno asignado
  // a otro usuario, hay que quitarle el rol (o eliminarlo) antes de asignar uno nuevo.
  try {
    if (rol === 'fontanero') {
      // Se confirma el destino antes de degradar al fontanero actual: si el
      // id no existe, el acueducto no debe quedarse sin fontanero.
      const { data: destino, error: errorDestino } = await profileModel.getById(userId, { columns: 'id' });
      if (errorDestino || !destino) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

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

    return res.status(200).json({
      message: activo ? 'Usuario activado' : 'Usuario desactivado',
      perfil: data,
    });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// Eliminar un usuario definitivamente.
// Borra la cuenta de Supabase Auth; por la cascada definida en el esquema
// (profiles -> auth.users, y los datos del usuario como titular -> profiles),
// esto también borra su perfil y su historial. Las averías asignadas a un
// fontanero conservan su historial y quedan sin asignación. Es irreversible:
// para solo bloquear el acceso sin perder el historial, usa
// cambiarEstadoUsuario (activo: false) en su lugar.
async function eliminarUsuario(req, res) {
  const { userId } = req.params;

  if (userId === req.usuario.id) {
    return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
  }

  try {
    // Las facturas y los pagos son la contabilidad del acueducto: un usuario
    // con historial no se borra, se desactiva (bloquea su acceso y lo saca de
    // la facturación, pero conserva todo). La base de datos también lo impide
    // con ON DELETE RESTRICT (migración 20261030_mejoras_integrales.sql).
    const [facturas, pagos] = await Promise.all([
      supabaseAdmin.from('invoices').select('id', { count: 'exact', head: true }).eq('perfil_id', userId),
      supabaseAdmin.from('payments').select('id', { count: 'exact', head: true }).eq('perfil_id', userId),
    ]);
    if (facturas.error) return errorConsulta(res, facturas.error);
    if (pagos.error) return errorConsulta(res, pagos.error);
    if ((facturas.count || 0) + (pagos.count || 0) > 0) {
      return res.status(409).json({
        error: `Este usuario tiene ${facturas.count || 0} factura(s) y ${pagos.count || 0} pago(s) registrados. Para no perder la contabilidad no se puede eliminar: desactívalo en su lugar.`,
        puedeDesactivar: true,
      });
    }

    // Quita primero la asignación activa para que la eliminación también
    // funcione en bases antiguas cuya FK aún no tiene ON DELETE SET NULL.
    const { error: errorAverias } = await breakdownModel.unassignFromPlumber(userId);
    if (errorAverias) return errorConsulta(res, errorAverias);

    const { error } = await authModel.deleteUser(userId);

    if (error) {
      const noExiste = /not found|no rows/i.test(error.message);
      if (noExiste) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }
      const bloqueoPorRelacion = error.code === '23503'
        || /foreign key|violates.*constraint|database error deleting user/i.test(error.message || '');
      if (bloqueoPorRelacion) {
        return res.status(409).json({
          error: 'Este usuario tiene registros asociados que no se pueden borrar. Desactívalo en su lugar.',
          puedeDesactivar: true,
        });
      }
      return errorConsulta(res, error);
    }

    // Su sesión en caché no debe seguir abriendo puertas tras borrarlo.
    cacheSesiones.invalidarUsuario(userId);
    return res.status(200).json({ message: 'Usuario eliminado permanentemente' });
  } catch (err) {
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
};
