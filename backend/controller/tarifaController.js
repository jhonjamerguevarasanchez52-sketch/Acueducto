const rateModel = require('../models/rateModel');
const { errorInesperado, errorConsulta } = require('../utils/httpErrores');
const { fechaBogota } = require('../utils/fechas');
const { registrarAuditoria } = require('../utils/auditoria');

const TIPOS_TARIFA = ['residencial', 'comercial', 'industrial'];
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function fechaValida(valor) {
  if (!FECHA_REGEX.test(String(valor))) return false;
  const fecha = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
}

// La cuota se cobra en pesos enteros: las facturas guardan valores enteros y
// la facturación automática la envía a la base de datos como integer. Una
// cuota de 0 no es una tarifa (la base de datos la ignora al facturar).
function validarCuota(cuota) {
  const valor = Number(cuota);
  if (!Number.isFinite(valor) || valor <= 0) return 'La cuota fija debe ser mayor que cero.';
  if (!Number.isInteger(valor)) return 'La cuota fija debe ser un valor en pesos, sin centavos.';
  return null;
}

// Valida tipo y vigencia. `actual` es la tarifa guardada (al editar), para
// comparar la nueva fecha con la que no cambia.
function validarTarifa({ tipo, vigente_desde, vigente_hasta }, actual = {}) {
  if (tipo !== undefined && !TIPOS_TARIFA.includes(tipo)) {
    return `Tipo de tarifa inválido. Usa: ${TIPOS_TARIFA.join(', ')}.`;
  }
  if (vigente_desde !== undefined && !fechaValida(vigente_desde)) {
    return 'La fecha "vigente desde" no es válida (AAAA-MM-DD).';
  }
  if (vigente_hasta !== undefined && vigente_hasta !== null && vigente_hasta !== '' && !fechaValida(vigente_hasta)) {
    return 'La fecha "vigente hasta" no es válida (AAAA-MM-DD).';
  }
  const desde = vigente_desde ?? actual.vigente_desde;
  const hasta = vigente_hasta === undefined ? actual.vigente_hasta : (vigente_hasta || null);
  if (desde && hasta && String(hasta).slice(0, 10) < String(desde).slice(0, 10)) {
    return 'La fecha "vigente hasta" no puede ser anterior a "vigente desde".';
  }
  return null;
}

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

// Ver la tarifa residencial vigente hoy (fecha de Colombia, igual que la
// facturación: entre las 7 p. m. y la medianoche el servidor en UTC ya vive
// en el día siguiente).
async function tarifaVigente(req, res) {
  try {
    const { data, error } = await rateModel.getCurrent(fechaBogota(), { db: req.db });

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

  const errorValidacion = validarCuota(cuota_fija) || validarTarifa({ tipo, vigente_desde, vigente_hasta });
  if (errorValidacion) return res.status(400).json({ error: errorValidacion });

  try {
    const { data, error } = await rateModel.create({
      tipo,
      cuota_fija: Number(cuota_fija),
      vigente_desde,
      vigente_hasta,
    });

    if (error) {
      return errorConsulta(res, error);
    }

    await registrarAuditoria({
      adminId: req.usuario?.id,
      accion: 'tarifa_creada',
      tabla: 'rates',
      registroId: data?.id,
      detalle: { tipo: data?.tipo, cuota_fija: data?.cuota_fija, vigente_desde, vigente_hasta: vigente_hasta || null },
    });

    return res.status(201).json({ message: 'Tarifa creada con éxito', tarifa: data });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// Actualizar una tarifa (por ejemplo cerrar su vigencia con vigente_hasta).
// Ojo: cambiar la cuota de una tarifa ya usada no modifica las facturas
// emitidas; para un aumento lo correcto es cerrar la vigencia y crear otra.
async function actualizarTarifa(req, res) {
  const { id } = req.params;
  const { cuota_fija, vigente_desde, vigente_hasta, tipo } = req.body;

  if (cuota_fija !== undefined) {
    const errorCuota = validarCuota(cuota_fija);
    if (errorCuota) return res.status(400).json({ error: errorCuota });
  }

  const cambios = {};
  if (cuota_fija !== undefined) cambios.cuota_fija = Number(cuota_fija);
  if (vigente_desde !== undefined) cambios.vigente_desde = vigente_desde;
  if (vigente_hasta !== undefined) cambios.vigente_hasta = vigente_hasta || null;
  if (tipo !== undefined) cambios.tipo = tipo;

  if (Object.keys(cambios).length === 0) {
    return res.status(400).json({ error: 'No hay campos para actualizar' });
  }

  try {
    const { data: actual, error: errorActual } = await rateModel.getById(id);
    if (errorActual?.code === 'PGRST116' || (!errorActual && !actual)) {
      return res.status(404).json({ error: 'Tarifa no encontrada' });
    }
    if (errorActual) return errorConsulta(res, errorActual);

    const errorValidacion = validarTarifa({ tipo, vigente_desde, vigente_hasta }, actual);
    if (errorValidacion) return res.status(400).json({ error: errorValidacion });

    const { data, error } = await rateModel.update(id, cambios);

    // PGRST116: ningún registro con ese id. Otros errores (fechas inválidas,
    // vigencias que se cruzan) no son "no encontrada".
    if (error?.code === 'PGRST116' || (!error && !data)) {
      return res.status(404).json({ error: 'Tarifa no encontrada' });
    }
    if (error) return errorConsulta(res, error);

    await registrarAuditoria({
      adminId: req.usuario?.id,
      accion: 'tarifa_actualizada',
      tabla: 'rates',
      registroId: id,
      detalle: {
        antes: Object.fromEntries(Object.keys(cambios).map((campo) => [campo, actual[campo] ?? null])),
        despues: cambios,
      },
    });

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

    if (error?.code === 'PGRST116' || (!error && !data)) {
      return res.status(404).json({ error: 'Tarifa no encontrada' });
    }
    if (error) return errorConsulta(res, error);

    await registrarAuditoria({
      adminId: req.usuario?.id,
      accion: 'tarifa_eliminada',
      tabla: 'rates',
      registroId: id,
      detalle: {
        tipo: data.tipo,
        cuota_fija: data.cuota_fija,
        vigente_desde: data.vigente_desde,
        vigente_hasta: data.vigente_hasta,
      },
    });

    return res.status(200).json({ message: 'Tarifa eliminada', tarifa: data });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

module.exports = {
  verTarifas,
  tarifaVigente,
  crearTarifa,
  actualizarTarifa,
  eliminarTarifa,
  validarCuota,
  validarTarifa,
};
