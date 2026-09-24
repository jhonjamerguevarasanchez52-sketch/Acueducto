const outageModel = require('../models/outageModel');
const profileModel = require('../models/profileModel');
const { notificar } = require('../utils/notificar');
const { errorInesperado, errorConsulta } = require('../utils/httpErrores');

// ---------- USUARIO FINAL ----------

// Ver mis cortes de servicio
async function misCortes(req, res) {
  const userId = req.usuario.id;

  try {
    const { data, error } = await outageModel.listByProfile(userId, req.db);

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
    const { data, error } = await outageModel.findActiveByProfile(userId, { db: req.db });

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
    const { data, error } = await outageModel.list({ estado, perfil_id, limit, offset });
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
    const { data: perfil, error: perfilError } = await profileModel.getById(perfil_id, { columns: 'id' });

    if (perfilError || !perfil) {
      return res.status(404).json({ error: 'El usuario indicado no existe' });
    }

    // No duplicar un corte activo para el mismo usuario
    const { data: existente, error: existenteError } = await outageModel.findActiveByProfile(perfil_id, {
      columns: 'id',
    });

    if (existenteError) {
      return errorConsulta(res, existenteError);
    }

    if (existente) {
      return res.status(409).json({ error: 'El usuario ya tiene un corte de servicio activo' });
    }

    const { data, error } = await outageModel.create({ perfil_id, motivo, factura_id });

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
    const { data, error } = await outageModel.reconnect(id);

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
    const { data, error } = await outageModel.remove(id);

    if (error || !data) {
      return res.status(404).json({ error: 'Corte no encontrado' });
    }

    return res.status(200).json({ message: 'Corte eliminado', corte: data });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

module.exports = { misCortes, estadoServicio, listarCortes, crearCorte, reconectar, eliminarCorte };
