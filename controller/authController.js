const { supabase } = require('../config/supabaseClient');
const supabaseAdmin = require('../config/supabaseAdminClient');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function registrar(req, res) {
  const { correo, password, nombre, apellido } = req.body;

  if (!correo || !password || !nombre || !apellido) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  if (!EMAIL_REGEX.test(correo)) {
    return res.status(400).json({ error: 'El correo no tiene un formato válido' });
  }

  if (typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
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

    // Usamos supabaseAdmin aquí, porque esta inserción la hace el backend
    // justo después del signUp, sin sesión de usuario activa todavía.
    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      id: userId,
      nombre,
      apellido,
      correo,
      rol: 'usuario',
      activo: true,
    });

    if (profileError) {
      // Revertimos el usuario de Auth para no dejarlo huérfano (sin perfil).
      await supabaseAdmin.auth.admin.deleteUser(userId).catch((e) => {
        console.error('No se pudo revertir el usuario huérfano:', e.message);
      });
      return res.status(500).json({ error: profileError.message });
    }

    return res.status(201).json({ message: 'Usuario registrado con éxito', userId });
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

module.exports = { registrar, iniciarSesion };
