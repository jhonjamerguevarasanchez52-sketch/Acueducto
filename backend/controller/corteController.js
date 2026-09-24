const supabaseAdmin = require('../config/supabaseAdminClient');
const { notificar } = require('../utils/notificar');
const { errorInesperado, errorConsulta } = require('../utils/httpErrores');
const { aplicarPaginacion } = require('../utils/paginacion');

// ---------- USUARIO FINAL ----------

// Ver mis cortes de servicio
async function misCortes(req, res) {
  const userId = req.usuario.id;

  try {
    const { data, error } = await req.db
      .from('service_outages')
      .select('*')
      .eq('perfil_id', userId)
      .order('fecha_corte', { ascending: false });

    if (error) {
      return errorConsulta(res, error);
    }

    return res.status(200).json(data);
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// Ver si mi servicio está activo actualmente
async function estadoServicio(req, res) {
  const userId = req.usuario.id;

  try {
    const { data, error } = await req.db
      .from('service_outages')
      .select('*')
      .eq('perfil_id', userId)
      .eq('estado', 'activo')
      .maybeSingle();

    if (error) {
      return errorConsulta(res, error);
    }

    return res.status(200).json({
      servicioCortado: !!data,
      corte: data || null,
    });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// ---------- ADMINISTRADOR ----------

// Ver todos los cortes, con filtro opcional ?estado=activo|reconectado
async function listarCortes(req, res) {
  const { estado, perfil_id, limit, offset } = req.query;

  try {
    let query = supabaseAdmin
      .from('service_outages')
      .select('*')
      .order('fecha_corte', { ascending: false });

    if (estado) query = query.eq('estado', estado);
    if (perfil_id) query = query.eq('perfil_id', perfil_id);
    query = aplicarPaginacion(query, { limit, offset });

    const { data, error } = await query;
    if (error) return errorConsulta(res, error);

    return res.status(200).json(data);
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// Registrar un corte de servicio para un usuario
async function crearCorte(req, res) {
  const { perfil_id, motivo, factura_id } = req.body;

  if (!perfil_id || !motivo) {
    return res.status(400).json({ error: 'perfil_id y motivo son obligatorios' });
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

    // No duplicar un corte activo para el mismo usuario
    const { data: existente, error: existenteError } = await supabaseAdmin
      .from('service_outages')
      .select('id')
      .eq('perfil_id', perfil_id)
      .eq('estado', 'activo')
      .maybeSingle();

    if (existenteError) {
      return errorConsulta(res, existenteError);
    }

    if (existente) {
      return res.status(409).json({ error: 'El usuario ya tiene un corte de servicio activo' });
    }

    const { data, error } = await supabaseAdmin
      .from('service_outages')
      .insert({
        perfil_id,
        motivo,
        factura_id: factura_id || null,
        estado: 'activo',
        fecha_corte: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      // 23505 = unique_violation. Cubre la carrera: dos solicitudes
      // concurrentes pueden pasar el chequeo "no duplicar" de arriba antes
      // de que cualquiera inserte; el índice único de la base de datos es
      // la garantía real, esto solo la traduce a la respuesta 409 esperada.
      if (error.code === '23505') {
        return res.status(409).json({ error: 'El usuario ya tiene un corte de servicio activo' });
      }
      return errorConsulta(res, error);
    }

    await notificar(
      perfil_id,
      `Tu servicio de agua fue suspendido. Motivo: ${motivo}.`,
      'corte'
    );

    return res.status(201).json({ message: 'Corte registrado', corte: data });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// Reconectar el servicio (marca el corte como resuelto)
async function reconectar(req, res) {
  const { id } = req.params;

  try {
    const { data, error } = await supabaseAdmin
      .from('service_outages')
      .update({
        estado: 'reconectado',
        fecha_reconexion: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Corte no encontrado' });
    }

    await notificar(data.perfil_id, 'Tu servicio de agua fue reconectado.', 'corte');

    return res.status(200).json({ message: 'Servicio reconectado', corte: data });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// Eliminar un registro de corte (por ejemplo, uno creado por error)
async function eliminarCorte(req, res) {
  const { id } = req.params;

  try {
    const { data, error } = await supabaseAdmin
      .from('service_outages')
      .delete()
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Corte no encontrado' });
    }

    return res.status(200).json({ message: 'Corte eliminado', corte: data });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

module.exports = { misCortes, estadoServicio, listarCortes, crearCorte, reconectar, eliminarCorte };
