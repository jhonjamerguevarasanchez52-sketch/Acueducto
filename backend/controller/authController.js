const authModel = require('../models/authModel');
const profileModel = require('../models/profileModel');
const { enviarCorreo } = require('../config/mailer');
const {
  segundosDeBloqueo,
  registrarFallo,
  registrarExito,
} = require('../utils/controlIntentos');
const { errorInesperado, errorConsulta } = require('../utils/httpErrores');
const { generarCodigoSeguridad, protegerCodigo, codigoCoincide } = require('../utils/securityCode');
const { normalizarCorreo } = require('../utils/formato');
const { escaparHtml } = require('../utils/html');
const cacheSesiones = require('../utils/cacheSesiones');

const MINUTOS_VALIDEZ_CODIGO = 15;
const MENSAJE_CODIGO_INVALIDO = 'Código incorrecto o expirado';

// Genera un código numérico de 6 dígitos
function generarCodigo() { return generarCodigoSeguridad(); }

function expiracionCodigo() {
  return new Date(Date.now() + MINUTOS_VALIDEZ_CODIGO * 60 * 1000).toISOString();
}

// El código se guarda protegido (HMAC, ver utils/securityCode.js) y se
// compara en tiempo constante.
function codigoValido(perfilId, guardado, recibido, expiracion) {
  return Boolean(expiracion)
    && new Date(expiracion) >= new Date()
    && codigoCoincide(perfilId, guardado, recibido);
}

function respuestaBloqueo(res, bloqueo, mensaje = 'Demasiados intentos fallidos') {
  return res.status(429).json({
    error: `${mensaje}. Vuelve a intentar en ${Math.ceil(bloqueo / 60)} minutos.`,
  });
}

// Supabase Auth responde en inglés. El usuario siempre ve un mensaje claro en
// español, sin revelar si el correo existe.
function mensajeErrorLogin(error) {
  const texto = String(error?.message || '').toLowerCase();
  if (texto.includes('email not confirmed')) {
    return 'Tu cuenta aún no está confirmada. Pide al administrador que la revise.';
  }
  if (texto.includes('banned') || texto.includes('disabled')) {
    return 'Tu cuenta está desactivada. Contacta al administrador.';
  }
  return 'Correo o contraseña incorrectos. Si no recuerdas tu contraseña, entra con un código a tu correo.';
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

// Revoca sesiones de Supabase a partir de un JWT de la cuenta y olvida las
// sesiones en caché del backend. Nunca rompe la petición: un fallo queda en
// el log (la contraseña ya cambió de todos modos).
async function cerrarSesiones(jwt, scope, userId) {
  cacheSesiones.invalidarUsuario(userId);
  if (!jwt) return;
  try {
    const { error } = await authModel.signOut(jwt, scope);
    if (error) console.error('[sesiones] no se pudieron cerrar las sesiones:', error.message);
  } catch (err) {
    console.error('[sesiones] no se pudieron cerrar las sesiones:', err.message);
  }
}

// Revisa que el perfil pueda entrar y, si la cuenta seguía sin verificar, la
// verifica: quien entra con la contraseña temporal o con el código que llegó a
// su correo ya demostró que el correo es suyo. Devuelve un error HTTP o null.
async function validarPerfilParaIngresar(userId) {
  const { data: perfil, error } = await reintentarServicioSupabase(
    () => profileModel.getById(userId, {
      columns: 'rol, is_verified, activo, debe_cambiar_password',
    }),
  );
  if (error) return { error };
  if (!perfil || !perfil.rol) {
    return { status: 403, mensaje: 'La cuenta no tiene un perfil activo en Acueducto Campo Amor.' };
  }
  if (perfil.activo === false) {
    return { status: 403, mensaje: 'Tu cuenta está desactivada. Contacta al administrador.' };
  }
  if (perfil.is_verified !== true) {
    const { error: errorVerificar } = await profileModel.saveFields(userId, {
      is_verified: true,
      codigo_verificacion: null,
      codigo_verificacion_expiracion: null,
    });
    if (errorVerificar) return { error: errorVerificar };
  }
  return { perfil };
}

// No hay endpoint de auto-registro: las cuentas las crea el administrador
// desde el panel (o con `scripts/crearUsuario.js`).

async function iniciarSesion(req, res) {
  const correo = normalizarCorreo(req.body.correo);
  const { password } = req.body;

  if (!correo || !password) {
    return res.status(400).json({ error: 'Correo y contraseña son obligatorios' });
  }

  const bloqueo = await segundosDeBloqueo('login', correo);
  if (bloqueo) return respuestaBloqueo(res, bloqueo);

  try {
    const { data, error } = await iniciarSesionSupabase(correo, password);

    if (error) {
      // No contar fallos de red como intentos de contraseña.
      if (esErrorTransitorioAuth(error)) return responderAuthNoDisponible(res, error);
      await registrarFallo('login', correo);
      return res.status(401).json({ error: mensajeErrorLogin(error) });
    }

    const resultado = await validarPerfilParaIngresar(data.user.id);
    if (resultado.error) {
      if (esErrorTransitorioAuth(resultado.error)) return responderAuthNoDisponible(res, resultado.error);
      return errorConsulta(res, resultado.error);
    }
    if (resultado.status) return res.status(resultado.status).json({ error: resultado.mensaje });

    await registrarExito('login', correo);
    return res.status(200).json({
      message: 'Inicio de sesión exitoso',
      session: data.session,
      user: data.user,
      // El frontend usa esto para forzar la pantalla de cambio de contraseña
      // cuando la cuenta fue creada por un administrador con clave temporal.
      debeCambiarPassword: resultado.perfil.debe_cambiar_password === true,
    });
  } catch (err) {
    if (esErrorTransitorioAuth(err)) return responderAuthNoDisponible(res, err);
    return errorInesperado(res, err);
  }
}

// --- INGRESO CON CÓDIGO AL CORREO (sin contraseña) ---
// Pensado para quien no recuerda su contraseña o no quiere usarla: recibe un
// código de 6 dígitos en el correo y entra con él. Responde siempre lo mismo
// para no revelar qué correos están registrados.
async function solicitarCodigoAcceso(req, res) {
  const correo = normalizarCorreo(req.body.correo);
  if (!correo) return res.status(400).json({ error: 'El correo es obligatorio' });

  const bloqueo = await segundosDeBloqueo('codigo-acceso-envio', correo);
  if (bloqueo) return respuestaBloqueo(res, bloqueo, 'Demasiadas solicitudes');
  await registrarFallo('codigo-acceso-envio', correo);

  const mensajeGenerico = {
    message: `Si el correo está registrado, te llegará un código de acceso válido por ${MINUTOS_VALIDEZ_CODIGO} minutos.`,
  };

  try {
    const { data: perfil, error } = await profileModel.findByEmail(correo, 'id, nombre, activo');
    if (error || !perfil || perfil.activo === false) return res.status(200).json(mensajeGenerico);

    const codigo = generarCodigo();
    const { error: errorGuardar } = await profileModel.saveFields(perfil.id, {
      codigo_acceso: protegerCodigo(perfil.id, codigo),
      codigo_acceso_expiracion: expiracionCodigo(),
    });
    if (errorGuardar) return errorConsulta(res, errorGuardar);

    try {
      const enviado = await enviarCorreo({
        to: correo,
        subject: `Tu código de acceso: ${codigo} - Acueducto Campo Amor`,
        html: `<p>Hola${perfil.nombre ? ` ${escaparHtml(perfil.nombre)}` : ''},</p>
               <p>Usa este código para entrar a la aplicación:</p>
               <h2 style="letter-spacing:6px;">${codigo}</h2>
               <p>Vence en ${MINUTOS_VALIDEZ_CODIGO} minutos. Si no lo pediste, ignora este correo.</p>`,
      });
      if (!enviado) throw new Error('El servicio de correo no confirmó el envío.');
    } catch (mailErr) {
      console.error('Error enviando código de acceso:', mailErr.message);
      await profileModel.saveFields(perfil.id, { codigo_acceso: null, codigo_acceso_expiracion: null });
      return res.status(503).json({ error: 'No pudimos enviar el código. Intenta de nuevo en unos minutos.' });
    }
    return res.status(200).json(mensajeGenerico);
  } catch (err) {
    return errorInesperado(res, err);
  }
}

async function ingresarConCodigo(req, res) {
  const correo = normalizarCorreo(req.body.correo);
  const { codigo } = req.body;
  if (!correo || !codigo) {
    return res.status(400).json({ error: 'Correo y código son obligatorios' });
  }

  const bloqueo = await segundosDeBloqueo('codigo-acceso', correo);
  if (bloqueo) return respuestaBloqueo(res, bloqueo);

  try {
    const { data: perfil, error } = await profileModel.findByEmail(
      correo,
      'id, codigo_acceso, codigo_acceso_expiracion'
    );
    if (error || !perfil || !codigoValido(perfil.id, perfil.codigo_acceso, codigo, perfil.codigo_acceso_expiracion)) {
      await registrarFallo('codigo-acceso', correo);
      return res.status(400).json({ error: MENSAJE_CODIGO_INVALIDO });
    }

    // El código es de un solo uso: se borra antes de crear la sesión, y solo
    // si sigue siendo el mismo. Si dos peticiones llegan a la vez con el mismo
    // código, solo una entra.
    const { consumido, error: errorLimpiar } = await profileModel.consumeCode(
      perfil.id,
      { columna: 'codigo_acceso', columnaExpiracion: 'codigo_acceso_expiracion' },
      perfil.codigo_acceso,
    );
    if (errorLimpiar) return errorConsulta(res, errorLimpiar);
    if (!consumido) {
      await registrarFallo('codigo-acceso', correo);
      return res.status(400).json({ error: MENSAJE_CODIGO_INVALIDO });
    }

    const resultado = await validarPerfilParaIngresar(perfil.id);
    if (resultado.error) return errorConsulta(res, resultado.error);
    if (resultado.status) return res.status(resultado.status).json({ error: resultado.mensaje });

    const { data, error: errorSesion } = await reintentarServicioSupabase(
      () => authModel.createSessionForEmail(correo),
    );
    if (errorSesion || !data?.session) {
      if (esErrorTransitorioAuth(errorSesion)) return responderAuthNoDisponible(res, errorSesion);
      console.error('[codigo-acceso] no se pudo crear la sesión:', errorSesion?.message);
      return res.status(500).json({ error: 'No pudimos iniciar tu sesión. Intenta de nuevo.' });
    }

    // Quien entra con código no necesita la contraseña temporal: no se le
    // obliga a cambiarla. Si quiere una contraseña propia, la crea con
    // "Olvidé mi contraseña" (código al correo), porque no conoce la temporal.
    if (resultado.perfil.debe_cambiar_password) {
      await profileModel.saveFields(perfil.id, { debe_cambiar_password: false });
    }

    await registrarExito('codigo-acceso', correo);
    await registrarExito('login', correo);
    return res.status(200).json({
      message: 'Inicio de sesión exitoso',
      session: data.session,
      user: data.user,
      debeCambiarPassword: false,
    });
  } catch (err) {
    if (esErrorTransitorioAuth(err)) return responderAuthNoDisponible(res, err);
    return errorInesperado(res, err);
  }
}

// Renueva una sesión previamente guardada en el dispositivo (renovación
// silenciosa del token o ingreso con huella).
async function renovarSesion(req, res) {
  const refreshToken = String(req.body.refreshToken || '').trim();
  if (!refreshToken) return res.status(400).json({ error: 'La sesión guardada no es válida.' });

  try {
    const { data, error } = await reintentarServicioSupabase(
      () => authModel.refreshSession(refreshToken),
    );
    if (error || !data?.user || !data?.session) {
      return res.status(401).json({ error: 'Tu sesión venció. Ingresa de nuevo con tu correo.' });
    }

    const { data: perfil, error: perfilError } = await profileModel.getById(data.user.id, {
      columns: 'rol, is_verified, activo, debe_cambiar_password',
    });
    if (perfilError || !perfil || !perfil.rol || perfil.is_verified !== true || perfil.activo === false) {
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
// Las cuentas nuevas ya nacen verificadas y las antiguas se verifican al
// entrar. Estas rutas se conservan para versiones anteriores de la app.

async function verificarCuenta(req, res) {
  const correo = normalizarCorreo(req.body.correo);
  const { codigo } = req.body;

  if (!correo || !codigo) {
    return res.status(400).json({ error: 'Correo y código son obligatorios' });
  }

  const bloqueo = await segundosDeBloqueo('verificar', correo);
  if (bloqueo) return respuestaBloqueo(res, bloqueo);

  try {
    const { data: perfil, error: buscarError } = await profileModel.findByEmail(
      correo,
      'id, rol, is_verified, codigo_verificacion, codigo_verificacion_expiracion'
    );

    // No revelamos si el correo existe: mismo mensaje que un código incorrecto.
    if (buscarError || !perfil) {
      await registrarFallo('verificar', correo);
      return res.status(400).json({ error: MENSAJE_CODIGO_INVALIDO });
    }

    if (perfil.is_verified) {
      return res.status(400).json({ error: 'La cuenta ya está verificada' });
    }

    if (!codigoValido(perfil.id, perfil.codigo_verificacion, codigo, perfil.codigo_verificacion_expiracion)) {
      await registrarFallo('verificar', correo);
      return res.status(400).json({ error: MENSAJE_CODIGO_INVALIDO });
    }

    const { error: updateError } = await profileModel.saveFields(perfil.id, {
      is_verified: true,
      codigo_verificacion: null,
      codigo_verificacion_expiracion: null,
    });

    if (updateError) {
      return errorConsulta(res, updateError);
    }

    await registrarExito('verificar', correo);
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
  const bloqueo = await segundosDeBloqueo('reenviar', correo);
  if (bloqueo) return respuestaBloqueo(res, bloqueo, 'Demasiadas solicitudes');
  await registrarFallo('reenviar', correo);

  try {
    const { data: perfil, error: buscarError } = await profileModel.findByEmail(
      correo,
      'id, rol, is_verified, nombre'
    );

    // No revelamos si el correo existe o ya está verificado: mismo mensaje siempre.
    const mensajeGenerico = { message: 'Si el correo existe y no ha sido verificado, se enviará un nuevo código' };

    if (buscarError || !perfil || perfil.is_verified) {
      return res.status(200).json(mensajeGenerico);
    }

    const codigoVerificacion = generarCodigo();

    const { error: updateError } = await profileModel.saveFields(perfil.id, {
      codigo_verificacion: protegerCodigo(perfil.id, codigoVerificacion),
      codigo_verificacion_expiracion: expiracionCodigo(),
    });

    if (updateError) {
      return errorConsulta(res, updateError);
    }

    try {
      const respuestaCorreo = await enviarCorreo({
        to: correo,
        subject: 'Nuevo código de verificación - Acueducto Campo Amor',
        html: `<p>Tu nuevo código de verificación es:</p>
               <h2>${codigoVerificacion}</h2>
               <p>Este código expira en ${MINUTOS_VALIDEZ_CODIGO} minutos.</p>`,
      });
      if (!respuestaCorreo) throw new Error('Brevo no confirmó el envío.');
    } catch (mailErr) {
      console.error('Error enviando correo de verificación:', mailErr.message);
      await profileModel.saveFields(perfil.id, {
        codigo_verificacion: null,
        codigo_verificacion_expiracion: null,
      });
      return res.status(503).json({ error: 'No pudimos enviar el código. Intenta de nuevo más tarde.' });
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

  const bloqueo = await segundosDeBloqueo('cambiar-password', correo);
  if (bloqueo) return respuestaBloqueo(res, bloqueo);

  try {
    // Confirmamos la contraseña actual reautenticando contra Supabase Auth,
    // en vez de confiar en que quien llama con el token es realmente el dueño.
    const { error: authError } = await iniciarSesionSupabase(correo, passwordActual);
    if (authError) {
      // Un fallo de red no es una contraseña incorrecta: no cuenta como intento.
      if (esErrorTransitorioAuth(authError)) return responderAuthNoDisponible(res, authError);
      await registrarFallo('cambiar-password', correo);
      return res.status(400).json({ error: 'La contraseña actual es incorrecta' });
    }

    const { error: updateAuthError } = await authModel.changePassword(userId, passwordNueva);
    if (updateAuthError) {
      return errorConsulta(res, updateAuthError);
    }

    // Se cierran las demás sesiones (otros teléfonos, el panel y la sesión
    // que acaba de abrir la verificación de arriba); esta sigue abierta.
    await cerrarSesiones(req.token, 'others', userId);

    const { error: updatePerfilError } = await profileModel.saveFields(userId, {
      debe_cambiar_password: false,
    });
    if (updatePerfilError) {
      return errorConsulta(res, updatePerfilError);
    }

    await registrarExito('cambiar-password', correo);
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
  const bloqueo = await segundosDeBloqueo('recuperar', correo);
  if (bloqueo) return respuestaBloqueo(res, bloqueo, 'Demasiadas solicitudes');
  await registrarFallo('recuperar', correo);

  try {
    const { data: perfil, error: buscarError } = await profileModel.findByEmail(correo, 'id, activo');

    // Igual que el ingreso con código: una cuenta desactivada no recibe
    // códigos (no podría entrar con la contraseña nueva).
    if (buscarError || !perfil || perfil.activo === false) {
      // No revelamos si el correo existe o no, por seguridad
      return res.status(200).json({ message: 'Si el correo existe, se enviará un código de recuperación' });
    }

    const codigoRecuperacion = generarCodigo();

    const { error: updateError } = await profileModel.saveFields(perfil.id, {
      codigo_recuperacion: protegerCodigo(perfil.id, codigoRecuperacion),
      codigo_expiracion: expiracionCodigo(),
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
              <p>Este código expira en ${MINUTOS_VALIDEZ_CODIGO} minutos. Si no solicitaste esto, ignora este correo.</p>`,
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

  const bloqueo = await segundosDeBloqueo('reset', correo);
  if (bloqueo) return respuestaBloqueo(res, bloqueo);

  try {
    const { data: perfil, error: buscarError } = await profileModel.findByEmail(
      correo,
      'id, rol, codigo_recuperacion, codigo_expiracion'
    );

    // Mismo mensaje y mismo conteo de intentos exista o no el correo: así no
    // se puede usar esta ruta para averiguar qué correos están registrados.
    if (buscarError || !perfil
      || !codigoValido(perfil.id, perfil.codigo_recuperacion, codigo, perfil.codigo_expiracion)) {
      await registrarFallo('reset', correo);
      return res.status(400).json({ error: MENSAJE_CODIGO_INVALIDO });
    }

    // El código es de un solo uso: se consume antes de cambiar la contraseña
    // para que dos peticiones simultáneas no lo usen las dos.
    const { consumido, error: errorConsumir } = await profileModel.consumeCode(
      perfil.id,
      { columna: 'codigo_recuperacion', columnaExpiracion: 'codigo_expiracion' },
      perfil.codigo_recuperacion,
    );
    if (errorConsumir) return errorConsulta(res, errorConsumir);
    if (!consumido) {
      await registrarFallo('reset', correo);
      return res.status(400).json({ error: MENSAJE_CODIGO_INVALIDO });
    }

    // La contraseña real vive en auth.users, se actualiza vía admin API
    const { error: authUpdateError } = await authModel.changePassword(perfil.id, nuevaPassword);
    if (authUpdateError) {
      return errorConsulta(res, authUpdateError);
    }

    const { error: updateError } = await profileModel.saveFields(perfil.id, {
      debe_cambiar_password: false,
    });

    if (updateError) {
      return errorConsulta(res, updateError);
    }

    await registrarExito('reset', correo);
    await registrarExito('login', correo);

    // Quien recupera la contraseña puede estar sacando a un intruso: se
    // cierran todas las sesiones abiertas con la contraseña anterior. Para
    // revocarlas hace falta un JWT de la cuenta, así que se abre una sesión
    // con la contraseña nueva y se cierra todo de forma global.
    try {
      const { data: sesionNueva } = await authModel.signIn(correo, nuevaPassword);
      await cerrarSesiones(sesionNueva?.session?.access_token, 'global', perfil.id);
    } catch (err) {
      console.error('[reset] no se pudieron cerrar las sesiones anteriores:', err.message);
    }

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
  iniciarSesion,
  solicitarCodigoAcceso,
  ingresarConCodigo,
  renovarSesion,
  verificarCuenta,
  reenviarCodigoVerificacion,
  cambiarPasswordPropio,
  solicitarRecuperacion,
  resetearPassword,
};
