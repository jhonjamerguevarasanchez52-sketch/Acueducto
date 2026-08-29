const crypto = require('crypto');
const supabase = require('../config/supabaseClient');
const supabaseAdmin = require('../config/supabaseAdminClient');
const { enviarCorreo } = require('../config/mailer');

// Genera un código numérico de 6 dígitos
function generarCodigo() {
  return crypto.randomInt(100000, 999999).toString();
}

async function registrar(req, res) {
  const { correo, password, nombre, apellido } = req.body;

  if (!correo || !password || !nombre || !apellido) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: correo,
      password: password,
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    const userId = authData.user?.id;
    if (!userId) {
      return res.status(500).json({ error: 'No se pudo crear el usuario' });
    }

    // Generamos el código de verificación de cuenta (expira en 15 minutos)
    const codigoVerificacion = generarCodigo();
    const codigoVerificacionExpiracion = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // Usamos supabaseAdmin aquí, porque esta inserción la hace el backend
    // justo después del signUp, sin sesión de usuario activa todavía.
    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      id: userId,
      nombre,
      apellido,
      correo,
      rol: 'usuario',
      activo: true,
      is_verified: false,
      codigo_verificacion: codigoVerificacion,
      codigo_verificacion_expiracion: codigoVerificacionExpiracion,
    });

    if (profileError) {
      return res.status(500).json({ error: profileError.message });
    }

    try {
      await enviarCorreo({
        to: correo,
        subject: 'Verifica tu cuenta - Acueducto Campoamor',
        html: `<p>Hola ${nombre},</p>
               <p>Tu código de verificación es:</p>
               <h2>${codigoVerificacion}</h2>
               <p>Este código expira en 15 minutos.</p>`,
      });
    } catch (mailErr) {
      console.error('Error enviando correo de verificación:', mailErr.message);
    }

    return res.status(201).json({
      message: 'Usuario registrado con éxito. Revisa tu correo para verificar la cuenta.',
      userId,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Error inesperado', detalle: err.message });
  }
}

async function iniciarSesion(req, res) {
  const { correo, password } = req.body;

  if (!correo || !password) {
    return res.status(400).json({ error: 'Correo y contraseña son obligatorios' });
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: correo,
      password: password,
    });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    return res.status(200).json({
      message: 'Inicio de sesión exitoso',
      session: data.session,
      user: data.user,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Error inesperado', detalle: err.message });
  }
}

// --- VERIFICACIÓN DE CUENTA ---

async function verificarCuenta(req, res) {
  const { correo, codigo } = req.body;

  if (!correo || !codigo) {
    return res.status(400).json({ error: 'Correo y código son obligatorios' });
  }

  try {
    const { data: perfil, error: buscarError } = await supabaseAdmin
      .from('profiles')
      .select('id, is_verified, codigo_verificacion, codigo_verificacion_expiracion')
      .eq('correo', correo)
      .single();

    if (buscarError || !perfil) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (perfil.is_verified) {
      return res.status(400).json({ error: 'La cuenta ya está verificada' });
    }

    if (perfil.codigo_verificacion !== codigo) {
      return res.status(400).json({ error: 'Código incorrecto' });
    }

    if (new Date(perfil.codigo_verificacion_expiracion) < new Date()) {
      return res.status(400).json({ error: 'El código ha expirado, solicita uno nuevo' });
    }

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        is_verified: true,
        codigo_verificacion: null,
        codigo_verificacion_expiracion: null,
      })
      .eq('id', perfil.id);

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    return res.status(200).json({ message: 'Cuenta verificada con éxito' });
  } catch (err) {
    return res.status(500).json({ error: 'Error inesperado', detalle: err.message });
  }
}

async function reenviarCodigoVerificacion(req, res) {
  const { correo } = req.body;

  if (!correo) {
    return res.status(400).json({ error: 'El correo es obligatorio' });
  }

  try {
    const { data: perfil, error: buscarError } = await supabaseAdmin
      .from('profiles')
      .select('id, is_verified')
      .eq('correo', correo)
      .single();

    if (buscarError || !perfil) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (perfil.is_verified) {
      return res.status(400).json({ error: 'La cuenta ya está verificada' });
    }

    const codigoVerificacion = generarCodigo();
    const codigoVerificacionExpiracion = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        codigo_verificacion: codigoVerificacion,
        codigo_verificacion_expiracion: codigoVerificacionExpiracion,
      })
      .eq('id', perfil.id);

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    try {
      await enviarCorreo({
        to: correo,
        subject: 'Nuevo código de verificación - Acueducto Campoamor',
        html: `<p>Tu nuevo código de verificación es:</p>
               <h2>${codigoVerificacion}</h2>
               <p>Este código expira en 15 minutos.</p>`,
      });
    } catch (mailErr) {
      console.error('Error enviando correo de verificación:', mailErr.message);
    }

    return res.status(200).json({ message: 'Nuevo código de verificación enviado' });
  } catch (err) {
    return res.status(500).json({ error: 'Error inesperado', detalle: err.message });
  }
}

// --- RECUPERACIÓN DE CONTRASEÑA ---

async function solicitarRecuperacion(req, res) {
  const { correo } = req.body;

  if (!correo) {
    return res.status(400).json({ error: 'El correo es obligatorio' });
  }

  try {
    const { data: perfil, error: buscarError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('correo', correo)
      .single();

    if (buscarError || !perfil) {
      // No revelamos si el correo existe o no, por seguridad
      return res.status(200).json({ message: 'Si el correo existe, se enviará un código de recuperación' });
    }

    const codigoRecuperacion = generarCodigo();
    const codigoExpiracion = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        codigo_recuperacion: codigoRecuperacion,
        codigo_expiracion: codigoExpiracion,
      })
      .eq('id', perfil.id);

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    try {
      await enviarCorreo({
        to: correo,
        subject: 'Recuperación de contraseña - Acueducto Campoamor',
        html: `<p>Tu código de recuperación es:</p>
               <h2>${codigoRecuperacion}</h2>
               <p>Este código expira en 15 minutos. Si no solicitaste esto, ignora este correo.</p>`,
      });
    } catch (mailErr) {
      console.error('Error enviando correo de recuperación:', mailErr.message);
    }

    return res.status(200).json({ message: 'Si el correo existe, se enviará un código de recuperación' });
  } catch (err) {
    return res.status(500).json({ error: 'Error inesperado', detalle: err.message });
  }
}

async function resetearPassword(req, res) {
  const { correo, codigo, nuevaPassword } = req.body;

  if (!correo || !codigo || !nuevaPassword) {
    return res.status(400).json({ error: 'Correo, código y nueva contraseña son obligatorios' });
  }

  try {
    const { data: perfil, error: buscarError } = await supabaseAdmin
      .from('profiles')
      .select('id, codigo_recuperacion, codigo_expiracion')
      .eq('correo', correo)
      .single();

    if (buscarError || !perfil) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (perfil.codigo_recuperacion !== codigo) {
      return res.status(400).json({ error: 'Código incorrecto' });
    }

    if (new Date(perfil.codigo_expiracion) < new Date()) {
      return res.status(400).json({ error: 'El código ha expirado, solicita uno nuevo' });
    }

    // La contraseña real vive en auth.users, se actualiza vía admin API
    const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
      perfil.id,
      { password: nuevaPassword }
    );

    if (authUpdateError) {
      return res.status(500).json({ error: authUpdateError.message });
    }

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        codigo_recuperacion: null,
        codigo_expiracion: null,
      })
      .eq('id', perfil.id);

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    return res.status(200).json({ message: 'Contraseña actualizada con éxito' });
  } catch (err) {
    return res.status(500).json({ error: 'Error inesperado', detalle: err.message });
  }
}

module.exports = {
  registrar,
  iniciarSesion,
  verificarCuenta,
  reenviarCodigoVerificacion,
  solicitarRecuperacion,
  resetearPassword,
};