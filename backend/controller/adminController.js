const supabaseAdmin = require('../config/supabaseAdminClient');
const { CAMPOS_EDITABLES_PERFIL, COLUMNAS_PERFIL_PUBLICO } = require('../utils/perfilCampos');
const { errorInesperado, errorConsulta } = require('../utils/httpErrores');
const { generarPasswordTemporal } = require('../utils/passwords');
const { enviarCorreo } = require('../config/mailer');
const { notificar } = require('../utils/notificar');
const { aplicarPaginacion } = require('../utils/paginacion');

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
  let userId;

  try {
    const { data: creado, error: crearError } = await supabaseAdmin.auth.admin.createUser({
      email: correo,
      password: passwordTemporal,
      email_confirm: true,
    });

    if (crearError) {
      const yaExiste = /already been registered|already exists|duplicate/i.test(crearError.message);
      return res.status(yaExiste ? 409 : 400).json({
        error: yaExiste ? 'Ese correo ya está registrado' : crearError.message,
      });
    }

    userId = creado.user.id;

    // El acueducto contempla un único fontanero: si se asigna, se quita al anterior.
    if (rol === 'fontanero') {
      const { error: errorDegradacion } = await supabaseAdmin
        .from('profiles')
        .update({ rol: 'usuario' })
        .eq('rol', 'fontanero');

      if (errorDegradacion) {
        await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
        return errorConsulta(res, errorDegradacion);
      }
    }

    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      id: userId,
      nombre,
      apellido,
      correo,
      rol,
      activo: true,
      is_verified: true,
      debe_cambiar_password: true,
    });

    if (profileError) {
      // Evitamos dejar un usuario huérfano en auth.users sin perfil asociado.
      await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
      return errorConsulta(res, profileError);
    }

    try {
      await enviarCorreo({
        to: correo,
        subject: 'Tu cuenta en Acueducto Campoamor',
        html: `<p>Hola ${nombre},</p>
               <p>Un administrador creó tu cuenta en Acueducto Campoamor. Esta es tu contraseña temporal:</p>
               <h2>${passwordTemporal}</h2>
               <p>Por seguridad, deberás cambiarla apenas inicies sesión por primera vez.</p>`,
      });
    } catch (mailErr) {
      console.error('Error enviando correo de cuenta creada:', mailErr.message);
    }

    // Además del correo, dejamos un aviso dentro de la app para cuando inicie sesión.
    await notificar(
      userId,
      'Tu cuenta fue creada con una contraseña temporal. Por seguridad, cámbiala desde tu perfil.',
      'seguridad'
    );

    return res.status(201).json({
      message: 'Usuario creado con éxito. Se envió la contraseña temporal por correo.',
      userId,
      // Se devuelve también aquí (solo visible para el administrador que crea
      // la cuenta) por si el envío de correo falla y hay que compartirla a mano.
      passwordTemporal,
    });
  } catch (err) {
    if (userId) {
      await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
    }
    return errorInesperado(res, err);
  }
}

// Listar todos los usuarios
async function verTodosUsuarios(req, res) {
  const { rol, activo, limit, offset } = req.query;

  try {
    let query = supabaseAdmin
      .from('profiles')
      .select(COLUMNAS_PERFIL_PUBLICO)
      .order('created_at', { ascending: false });

    if (rol) query = query.eq('rol', rol);
    if (activo === 'true') query = query.eq('activo', true);
    if (activo === 'false') query = query.eq('activo', false);
    query = aplicarPaginacion(query, { limit, offset });

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

// Eliminar un usuario definitivamente.
// Borra la cuenta de Supabase Auth; por la cascada definida en el esquema
// (profiles -> auth.users, e invoices/payments/breakdowns/notifications/
// service_outages -> profiles, todas "on delete cascade"), esto arrastra
// también el perfil y TODO su historial (facturas, pagos, averías,
// notificaciones y cortes). Es irreversible: para solo bloquear el acceso
// sin perder el historial, usa cambiarEstadoUsuario (activo: false) en su lugar.
async function eliminarUsuario(req, res) {
  const { userId } = req.params;

  if (userId === req.usuario.id) {
    return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
  }

  try {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (error) {
      const noExiste = /not found|no rows/i.test(error.message);
      if (noExiste) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }
      return errorConsulta(res, error);
    }

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
