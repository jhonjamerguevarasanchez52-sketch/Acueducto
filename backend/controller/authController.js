const crypto = require('crypto');
const authModel = require('../models/authModel');
const profileModel = require('../models/profileModel');
const { enviarCorreo } = require('../config/mailer');
const {
  segundosDeBloqueo,
  registrarFallo,
  registrarExito,
} = require('../utils/controlIntentos');
const { errorInesperado, errorConsulta } = require('../utils/httpErrores');

// Genera un código numérico de 6 dígitos
function generarCodigo() {
  return crypto.randomInt(100000, 999999).toString();
}

function normalizarCorreo(correo) {
  return String(correo || '').toLowerCase().trim();
}


// Errores de transporte de Supabase Auth no significan que la contraseña sea
// incorrecta. Reconocemos también errores de DNS/TLS/socket que varían según
// la versión de Node, el sistema operativo y el proveedor de hosting.
function esErrorTransitorioAuth(error) {
  const texto = [error?.name, error?.message, error?.code,
    error?.cause?.code, error?.cause?.name, error?.cause?.message]
    .filter(Boolean).join(' ').toLowerCase();
  const estado = Number(error?.status ?? error?.statusCode ?? error?.cause?.status);
  return [500, 502, 503, 504].includes(estado)
    || /authretryablefetcherror|fetch failed|network|econnreset|econnrefused|etimedout|eai_again|enotfound|und_err_connect_timeout|socket hang up|tls|service unavailable|bad gateway|gateway timeout/.test(texto);
}

async function reintentarServicioSupabase(operacion) {
  // Reintentos breves para recuperarse de fallos puntuales de red o de
  // disponibilidad tanto en Auth como en la consulta de perfil.
  for (let intento = 0; ; intento++) {
    try {
      const resultado = await operacion();
      if (!resultado.error || !esErrorTransitorioAuth(resultado.error) || intento >= 2) {
        return resultado;
      }
    } catch (error) {
      if (!esErrorTransitorioAuth(error) || intento >= 2) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 300 * (2 ** intento)));
  }
}

async function iniciarSesionSupabase(correo, password) {
  return reintentarServicioSupabase(() => authModel.signIn(correo, password));
}

function responderAuthNoDisponible(res, error) {
  console.error('[login] Falló la conexión con Supabase Auth tras reintentos:', {
    name: error?.name,
    causeName: error?.cause?.name,
    causeCode: error?.cause?.code,
    causeMessage: error?.cause?.message,
  });
  return res.status(503).json({
    error: 'No pudimos conectar con el servicio de acceso. Revisa tu conexión e inténtalo de nuevo.',
  });
}

async function verificarCorreoAdministrador(req, res) {
  const correo = normalizarCorreo(req.body.correo);
  if (!correo) return res.status(400).json({ error: 'El correo es obligatorio' });
  try {
    const { data: perfil, error } = await profileModel.findByEmail(correo, 'id, rol');
    if (error && error.code !== 'PGRST116') return errorConsulta(res, error);
    if (!perfil || perfil.rol !== 'administrador') {
      return res.status(403).json({ esAdministrador: false, error: 'Este correo no está registrado en la base de datos.' });
    }
    return res.status(200).json({ esAdministrador: true });
  } catch (err) { return errorInesperado(res, err); }

}

// No hay endpoint de auto-registro: las cuentas las crea el administrador con
// `scripts/crearUsuario.js` (Auth + fila en `profiles` con is_verified = true).
// El flujo de verificación por código de abajo sigue disponible por si una
// cuenta se crea sin verificar.

async function iniciarSesion(req, res) {
  const correo = normalizarCorreo(req.body.correo);
  const { password } = req.body;

  if (!correo || !password) {
    return res.status(400).json({ error: 'Correo y contraseña son obligatorios' });
  }

  const bloqueo = segundosDeBloqueo('login', correo);
  if (bloqueo) {
    return res.status(429).json({
      error: `Demasiados intentos fallidos. Vuelve a intentar en ${Math.ceil(bloqueo / 60)} minutos.`,
    });
  }

  try {
    const { data, error } = await iniciarSesionSupabase(correo, password);
    const { data: adminPerfil, error: adminError } = await profileModel.findByEmail(correo, 'id, rol');
    if (adminError && adminError.code !== 'PGRST116') return errorConsulta(res, adminError);
    if (!adminPerfil || adminPerfil.rol !== 'administrador') {
      return res.status(403).json({ error: 'Este correo no está registrado en la base de datos.' });
    }
    if (error) {
      // No contar fallos de red como intentos de contraseña.
      if (esErrorTransitorioAuth(error)) return responderAuthNoDisponible(res, error);

      registrarFallo('login', correo);
      return res.status(401).json({ error: error.message });
    }

    // Exigimos que la cuenta esté verificada por código antes de permitir el acceso.
    const { data: perfil, error: perfilError } = await reintentarServicioSupabase(
      () => profileModel.getById(data.user.id, {
        columns: 'is_verified, activo, debe_cambiar_password',
      }),
    );

    if (perfilError) {
      if (esErrorTransitorioAuth(perfilError)) {
        return responderAuthNoDisponible(res, perfilError);
      }
      return errorConsulta(res, perfilError);
    }

    if (!perfil || perfil.is_verified !== true) {
      return res.status(403).json({
        error: 'Debes verificar tu cuenta antes de iniciar sesión.',
        requiereVerificacion: true,
      });
    }

    if (perfil.activo === false) {
      return res.status(403).json({ error: 'Tu cuenta está desactivada. Contacta al administrador.' });
    }

    registrarExito('login', correo);
    return res.status(200).json({
      message: 'Inicio de sesión exitoso',
      session: data.session,
      user: data.user,
      // El frontend usa esto para forzar la pantalla de cambio de contraseña
      // cuando la cuenta fue creada por un administrador con clave temporal.
      debeCambiarPassword: perfil.debe_cambiar_password === true,
    });
  } catch (err) {
    if (esErrorTransitorioAuth(err)) return responderAuthNoDisponible(res, err);
    return errorInesperado(res, err);
  }
}

// Renueva una sesión previamente guardada en el dispositivo. El refresh token
// solo se envía después de que el sistema operativo valide biometría.
async function renovarSesion(req, res) {
  const refreshToken = String(req.body.refreshToken || '').trim();
  if (!refreshToken) return res.status(400).json({ error: 'La sesión guardada no es válida.' });
  try {
    const { data, error } = await reintentarServicioSupabase(
      () => authModel.refreshSession(refreshToken),
    );
    if (error || !data?.user || !data?.session) {
      return res.status(401).json({ error: 'La sesión biométrica venció. Ingresa con tu correo y contraseña.' });
    }
    const { data: perfil, error: perfilError } = await profileModel.getById(data.user.id, {
      columns: 'rol, is_verified, activo, debe_cambiar_password',
    });
    if (perfilError || !perfil || perfil.rol !== 'administrador' || perfil.is_verified !== true || perfil.activo === false) {
      return res.status(403).json({ error: 'Esta cuenta no puede iniciar sesión. Contacta al administrador.' });
    }
    return res.status(200).json({
      session: data.session,
      debeCambiarPassword: perfil.debe_cambiar_password === true,
    });
  } catch (err) {
    if (esErrorTransitorioAuth(err)) return responderAuthNoDisponible(res, err);
    return errorInesperado(res, err);
  }
}


// --- VERIFICACIÓN DE CUENTA ---

async function verificarCuenta(req, res) {
  const correo = normalizarCorreo(req.body.correo);
  const { codigo } = req.body;

  if (!correo || !codigo) {
    return res.status(400).json({ error: 'Correo y código son obligatorios' });
  }

  const bloqueo = segundosDeBloqueo('verificar', correo);
  if (bloqueo) {
    return res.status(429).json({
      error: `Demasiados intentos fallidos. Vuelve a intentar en ${Math.ceil(bloqueo / 60)} minutos.`,
    });
  }

  try {
    const { data: perfil, error: buscarError } = await profileModel.findByEmail(
      correo,
      'id, rol, is_verified, codigo_verificacion, codigo_verificacion_expiracion'
    );

    if (perfil?.rol !== 'administrador') return res.status(403).json({ error: 'Este correo no está registrado en la base de datos.' });

    // No revelamos si el correo existe: mismo mensaje que un código incorrecto.
    if (buscarError || !perfil) {
      registrarFallo('verificar', correo);
      return res.status(400).json({ error: 'Código incorrecto o expirado' });
    }

    if (perfil.is_verified) {
      return res.status(400).json({ error: 'La cuenta ya está verificada' });
    }

    if (
      !perfil.codigo_verificacion ||
      perfil.codigo_verificacion !== codigo ||
      new Date(perfil.codigo_verificacion_expiracion) < new Date()
    ) {
      registrarFallo('verificar', correo);
      return res.status(400).json({ error: 'Código incorrecto o expirado' });
    }

    const { error: updateError } = await profileModel.saveFields(perfil.id, {
      is_verified: true,
      codigo_verificacion: null,
      codigo_verificacion_expiracion: null,
    });

    if (updateError) {
      return errorConsulta(res, updateError);
    }

    registrarExito('verificar', correo);
    return res.status(200).json({ message: 'Cuenta verificada con éxito' });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

async function reenviarCodigoVerificacion(req, res) {
  const correo = normalizarCorreo(req.body.correo);

  if (!correo) {
    return res.status(400).json({ error: 'El correo es obligatorio' });
  }

  // Contamos cada solicitud (exista o no la cuenta) para no revelar por
  // temporización/bloqueo si el correo está registrado, y para frenar el
  // "email-bombing" de códigos a una bandeja de entrada real.
  const bloqueo = segundosDeBloqueo('reenviar', correo);
  if (bloqueo) {
    return res.status(429).json({
      error: `Demasiadas solicitudes. Vuelve a intentar en ${Math.ceil(bloqueo / 60)} minutos.`,
    });
  }
  registrarFallo('reenviar', correo);

  try {
    const { data: perfil, error: buscarError } = await profileModel.findByEmail(
      correo,
      'id, rol, is_verified, nombre'
    );

    if (perfil?.rol !== 'administrador') return res.status(403).json({ error: 'Este correo no está registrado en la base de datos.' });

    // No revelamos si el correo existe o ya está verificado: mismo mensaje siempre.
    const mensajeGenerico = { message: 'Si el correo existe y no ha sido verificado, se enviará un nuevo código' };

    if (buscarError || !perfil || perfil.is_verified) {
      return res.status(200).json(mensajeGenerico);
    }

    const codigoVerificacion = generarCodigo();
    const codigoVerificacionExpiracion = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const { error: updateError } = await profileModel.saveFields(perfil.id, {
      codigo_verificacion: codigoVerificacion,
      codigo_verificacion_expiracion: codigoVerificacionExpiracion,
    });

    if (updateError) {
      return errorConsulta(res, updateError);
    }

    try {
      await enviarCorreo({
        to: correo,
        subject: 'Nuevo código de verificación - Acueducto Campo Amor',
        html: `<p>Tu nuevo código de verificación es:</p>
               <h2>${codigoVerificacion}</h2>
               <p>Este código expira en 15 minutos.</p>`,
      });
    } catch (mailErr) {
      console.error('Error enviando correo de verificación:', mailErr.message);
    }

    return res.status(200).json(mensajeGenerico);
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// --- CAMBIO DE CONTRASEÑA (usuario autenticado) ---

// Usada tras el primer login con una contraseña temporal generada por un
// administrador, pero también sirve como cambio de contraseña voluntario.
async function cambiarPasswordPropio(req, res) {
  const userId = req.usuario.id;
  const correo = normalizarCorreo(req.usuario.email);
  const { passwordActual, passwordNueva } = req.body;

  if (!passwordActual || !passwordNueva) {
    return res.status(400).json({ error: 'La contraseña actual y la nueva son obligatorias' });
  }

  if (String(passwordNueva).length < 8) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' });
  }

  if (passwordNueva === passwordActual) {
    return res.status(400).json({ error: 'La nueva contraseña debe ser distinta de la actual' });
  }

  try {
    // Confirmamos la contraseña actual reautenticando contra Supabase Auth,
    // en vez de confiar en que quien llama con el token es realmente el dueño.
    const { error: authError } = await authModel.signIn(correo, passwordActual);

    if (authError) {
      return res.status(400).json({ error: 'La contraseña actual es incorrecta' });
    }

    const { error: updateAuthError } = await authModel.changePassword(userId, passwordNueva);

    if (updateAuthError) {
      return errorConsulta(res, updateAuthError);
    }

    const { error: updatePerfilError } = await profileModel.saveFields(userId, {
      debe_cambiar_password: false,
    });

    if (updatePerfilError) {
      return errorConsulta(res, updatePerfilError);
    }

    return res.status(200).json({ message: 'Contraseña actualizada con éxito' });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// --- RECUPERACIÓN DE CONTRASEÑA ---

async function solicitarRecuperacion(req, res) {
  const correo = normalizarCorreo(req.body.correo);

  if (!correo) {
    return res.status(400).json({ error: 'El correo es obligatorio' });
  }

  // Igual que en reenviarCodigoVerificacion: contamos cada solicitud exista o
  // no la cuenta, para no filtrar su existencia vía el bloqueo por spam.
  const bloqueo = segundosDeBloqueo('recuperar', correo);
  if (bloqueo) {
    return res.status(429).json({
      error: `Demasiadas solicitudes. Vuelve a intentar en ${Math.ceil(bloqueo / 60)} minutos.`,
    });
  }
  registrarFallo('recuperar', correo);

  try {
    const { data: perfil, error: buscarError } = await profileModel.findByEmail(correo, 'id, rol');

    if (buscarError || !perfil || perfil.rol !== 'administrador') {
      // No revelamos si el correo existe o no, por seguridad
      return res.status(200).json({ message: 'Si el correo existe, se enviará un código de recuperación' });
    }

    const codigoRecuperacion = generarCodigo();
    const codigoExpiracion = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const { error: updateError } = await profileModel.saveFields(perfil.id, {
      codigo_recuperacion: codigoRecuperacion,
      codigo_expiracion: codigoExpiracion,
    });

    if (updateError) {
      return errorConsulta(res, updateError);
    }

    try {
      const resultadoCorreo = await enviarCorreo({
        to: correo,
        subject: 'Recuperación de contraseña - Acueducto Campo Amor',
        html: `<p>Tu código de recuperación es:</p>
              <h2>${codigoRecuperacion}</h2>
              <p>Este código expira en 15 minutos. Si no solicitaste esto, ignora este correo.</p>`,
      });
      if (!resultadoCorreo) throw new Error('El servicio de correo no está configurado.');
    } catch (mailErr) {
      console.error('Error enviando correo de recuperación:', mailErr.message);
      const { error: limpiarError } = await profileModel.saveFields(perfil.id, {
        codigo_recuperacion: null,
        codigo_expiracion: null,
      });
      if (limpiarError) console.error('No se pudo invalidar el código de recuperación:', limpiarError.message);
      return res.status(503).json({ error: 'No pudimos enviar el código de recuperación. Intenta de nuevo más tarde.' });
    }

    return res.status(200).json({ message: 'Si el correo existe, se enviará un código de recuperación' });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

async function resetearPassword(req, res) {
  const correo = normalizarCorreo(req.body.correo);
  const { codigo, nuevaPassword } = req.body;

  if (!correo || !codigo || !nuevaPassword) {
    return res.status(400).json({ error: 'Correo, código y nueva contraseña son obligatorios' });
  }

  if (String(nuevaPassword).length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  }

  const bloqueo = segundosDeBloqueo('reset', correo);
  if (bloqueo) {
    return res.status(429).json({
      error: `Demasiados intentos fallidos. Vuelve a intentar en ${Math.ceil(bloqueo / 60)} minutos.`,
    });
  }

  try {
    const { data: perfil, error: buscarError } = await profileModel.findByEmail(
      correo,
      'id, rol, codigo_recuperacion, codigo_expiracion'
    );

    if (perfil?.rol !== 'administrador') return res.status(403).json({ error: 'Este correo no está registrado en la base de datos.' });

    if (buscarError || !perfil) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (
      !perfil.codigo_recuperacion ||
      perfil.codigo_recuperacion !== codigo ||
      new Date(perfil.codigo_expiracion) < new Date()
    ) {
      registrarFallo('reset', correo);
      return res.status(400).json({ error: 'Código incorrecto o expirado' });
    }

    // La contraseña real vive en auth.users, se actualiza vía admin API
    const { error: authUpdateError } = await authModel.changePassword(perfil.id, nuevaPassword);

    if (authUpdateError) {
      return errorConsulta(res, authUpdateError);
    }

    const { error: updateError } = await profileModel.saveFields(perfil.id, {
      codigo_recuperacion: null,
      codigo_expiracion: null,
    });

    if (updateError) {
      return errorConsulta(res, updateError);
    }

    registrarExito('reset', correo);

    try {
      await enviarCorreo({
        to: correo,
        subject: 'Tu contraseña fue actualizada - Acueducto Campo Amor',
        html: `<p>Tu contraseña se actualizó correctamente.</p>
               <p>Si no realizaste este cambio, contacta de inmediato al administrador del acueducto.</p>`,
      });
    } catch (mailErr) {
      console.error('Error enviando correo de confirmación de cambio de contraseña:', mailErr.message);
    }

    return res.status(200).json({ message: 'Contraseña actualizada con éxito' });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

module.exports = {
  verificarCorreoAdministrador,
  iniciarSesion,
  renovarSesion,
  verificarCuenta,
  reenviarCodigoVerificacion,
  cambiarPasswordPropio,
  solicitarRecuperacion,
  resetearPassword,
};
