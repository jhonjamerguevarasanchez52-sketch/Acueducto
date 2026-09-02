const supabaseAdmin = require('../config/supabaseAdminClient');
const { notificar } = require('../utils/notificar');

// ---------- USUARIO FINAL ----------

// Ver mis facturas
async function misFacturas(req, res) {
  const userId = req.usuario.id;

  try {
    const { data, error } = await req.db
      .from('invoices')
      .select('*')
      .eq('perfil_id', userId)
      .order('fecha_emision', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Error inesperado', detalle: err.message });
  }
}

// Ver una factura específica (propia)
async function verFactura(req, res) {
  const userId = req.usuario.id;
  const { id } = req.params;

  try {
    const { data, error } = await req.db
      .from('invoices')
      .select('*')
      .eq('id', id)
      .eq('perfil_id', userId) // asegura que solo vea sus propias facturas
      .single();

    if (error) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Error inesperado', detalle: err.message });
  }
}

// ---------- ADMINISTRADOR ----------

// Listar todas las facturas, con filtros opcionales ?estado= y ?perfil_id=
async function listarFacturas(req, res) {
  const { estado, perfil_id } = req.query;

  try {
    let query = supabaseAdmin
      .from('invoices')
      .select('*')
      .order('fecha_emision', { ascending: false });

    if (estado) query = query.eq('estado', estado);
    if (perfil_id) query = query.eq('perfil_id', perfil_id);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Error inesperado', detalle: err.message });
  }
}

// Emitir una factura para un usuario
async function crearFactura(req, res) {
  const { perfil_id, periodo, valor_total, fecha_vencimiento, observacion } = req.body;

  if (!perfil_id || !periodo || valor_total === undefined) {
    return res.status(400).json({
      error: 'perfil_id, periodo y valor_total son obligatorios',
    });
  }

  if (Number(valor_total) <= 0) {
    return res.status(400).json({ error: 'valor_total debe ser mayor que cero' });
  }

  try {
    // Verificamos que el usuario destino exista
    const { data: perfil, error: perfilError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', perfil_id)
      .single();

    if (perfilError || !perfil) {
      return res.status(404).json({ error: 'El usuario indicado no existe' });
    }

    const { data, error } = await supabaseAdmin
      .from('invoices')
      .insert({
        perfil_id,
        periodo,
        valor_total,
        estado: 'pendiente',
        fecha_emision: new Date().toISOString(),
        fecha_vencimiento: fecha_vencimiento || null,
        observacion: observacion || null,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    await notificar(
      perfil_id,
      `Se generó tu factura del periodo ${periodo} por $${valor_total}.`,
      'factura'
    );

    return res.status(201).json({ message: 'Factura creada', factura: data });
  } catch (err) {
    return res.status(500).json({ error: 'Error inesperado', detalle: err.message });
  }
}

// Actualizar el estado de una factura (pendiente | pagada | anulada | vencida)
async function actualizarFactura(req, res) {
  const { id } = req.params;
  const { estado, valor_total, fecha_vencimiento, observacion } = req.body;

  const estadosValidos = ['pendiente', 'pagada', 'anulada', 'vencida'];
  if (estado && !estadosValidos.includes(estado)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }

  const cambios = {};
  if (estado) cambios.estado = estado;
  if (valor_total !== undefined) cambios.valor_total = valor_total;
  if (fecha_vencimiento !== undefined) cambios.fecha_vencimiento = fecha_vencimiento;
  if (observacion !== undefined) cambios.observacion = observacion;

  if (Object.keys(cambios).length === 0) {
    return res.status(400).json({ error: 'No hay campos para actualizar' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('invoices')
      .update(cambios)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }

    return res.status(200).json({ message: 'Factura actualizada', factura: data });
  } catch (err) {
    return res.status(500).json({ error: 'Error inesperado', detalle: err.message });
  }
}

module.exports = {
  misFacturas,
  verFactura,
  listarFacturas,
  crearFactura,
  actualizarFactura,
};
