const supabase = require('../config/supabaseClient.js');
const supabaseAdmin = require('../config/supabaseAdminClient.js');

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

    // Traer el perfil para incluir rol, zona, nombre, etc.
    const { data: perfil, error: errorPerfil } = await supabaseAdmin
      .from('profiles')
      .select('id, rol, zona, nombre, apellido')
      .eq('id', data.user.id)
      .single();

    if (errorPerfil || !perfil) {
      return res.status(404).json({ error: 'Perfil de usuario no encontrado' });
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