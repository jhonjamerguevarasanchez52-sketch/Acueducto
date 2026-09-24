const rateModel = require('../models/rateModel');
const { errorInesperado, errorConsulta } = require('../utils/httpErrores');

// ---------- LECTURA (cualquier usuario autenticado) ----------

// Ver todas las tarifas
async function verTarifas(req, res) {
  try {
    const { data, error } = await rateModel.list(req.db);

    if (error) {
      return errorConsulta(res, error);
    }

    return res.status(200).json(data);
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// Ver la tarifa residencial vigente actualmente
async function tarifaVigente(req, res) {
  const hoy = new Date().toISOString().split('T')[0];

  try {
    const { data, error } = await rateModel.getCurrent(hoy, { db: req.db });

    if (error) {
      return res.status(404).json({ error: 'No hay tarifa vigente configurada' });
    }

    return res.status(200).json(data);
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// ---------- ADMINISTRADOR ----------

// Crear una nueva tarifa
async function crearTarifa(req, res) {
  const { tipo, cuota_fija, vigente_desde, vigente_hasta } = req.body;

  if (cuota_fija === undefined || !vigente_desde) {
    return res.status(400).json({ error: 'cuota_fija y vigente_desde son obligatorios' });
  }

  if (!Number.isFinite(Number(cuota_fija)) || Number(cuota_fija) < 0) {
    return res.status(400).json({ error: 'cuota_fija no puede ser negativa' });
  }

  try {
    const { data, error } = await rateModel.create({ tipo, cuota_fija, vigente_desde, vigente_hasta });

    if (error) {
      return errorConsulta(res, error);
    }

    return res.status(201).json({ message: 'Tarifa creada con éxito', tarifa: data });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// Actualizar una tarifa (por ejemplo cerrar su vigencia con vigente_hasta)
async function actualizarTarifa(req, res) {
  const { id } = req.params;
  const { cuota_fija, vigente_desde, vigente_hasta, tipo } = req.body;

  const cambios = {};
  if (cuota_fija !== undefined) cambios.cuota_fija = cuota_fija;
  if (vigente_desde !== undefined) cambios.vigente_desde = vigente_desde;
  if (vigente_hasta !== undefined) cambios.vigente_hasta = vigente_hasta;
  if (tipo !== undefined) cambios.tipo = tipo;

  if (Object.keys(cambios).length === 0) {
    return res.status(400).json({ error: 'No hay campos para actualizar' });
  }

  try {
    const { data, error } = await rateModel.update(id, cambios);

    if (error || !data) {
      return res.status(404).json({ error: 'Tarifa no encontrada' });
    }

    return res.status(200).json({ message: 'Tarifa actualizada', tarifa: data });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// Eliminar una tarifa creada por error
async function eliminarTarifa(req, res) {
  const { id } = req.params;

  try {
    const { data, error } = await rateModel.remove(id);

    if (error || !data) {
      return res.status(404).json({ error: 'Tarifa no encontrada' });
    }

    return res.status(200).json({ message: 'Tarifa eliminada', tarifa: data });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

module.exports = { verTarifas, tarifaVigente, crearTarifa, actualizarTarifa, eliminarTarifa };
