async function verPerfil(req, res) {
  const userId = req.usuario.id;

  try {
    const { data, error } = await req.db
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Error inesperado', detalle: err.message });
  }
}

async function editarPerfil(req, res) {
  const userId = req.usuario.id;
  const camposPermitidos = [
    'nombre', 'apellido', 'telefono', 'numero_lote',
    'direccion', 'ocupacion', 'zona',
  ];

  const datosActualizar = {};
  for (const campo of camposPermitidos) {
    if (req.body[campo] !== undefined) {
      datosActualizar[campo] = req.body[campo];
    }
  }

  if (Object.keys(datosActualizar).length === 0) {
    return res.status(400).json({ error: 'No hay campos válidos para actualizar' });
  }

  try {
    const { data, error } = await req.db
      .from('profiles')
      .update(datosActualizar)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ message: 'Perfil actualizado', perfil: data });
  } catch (err) {
    return res.status(500).json({ error: 'Error inesperado', detalle: err.message });
  }
}

module.exports = { verPerfil, editarPerfil };
