const invoiceModel = require('../models/invoiceModel');
const paymentModel = require('../models/paymentModel');
const profileModel = require('../models/profileModel');
const supabaseAdmin = require('../config/supabaseAdminClient');
const { notificar } = require('../utils/notificar');
const { enviarCorreo } = require('../config/mailer');
const { errorInesperado, errorConsulta } = require('../utils/httpErrores');

const {
  VALOR_MENSUAL,
  generarFacturasMensuales: ejecutarFacturacionMensual,
} = require('../services/facturacionMensual');
const {
  MESES_DISPONIBLES,
  calcularPeriodosPlan,
  esPeriodoValido,
  nombrePeriodo,
} = require('../services/planPagoServicio');
const { cotizarWompi } = require('../utils/wompiTarifa');

const { escaparHtml } = require('../utils/html');
const { fechaLarga } = require('../utils/fechas');


function formatearMoneda(valor) {
  return Number(valor).toLocaleString('es-CO');
}

async function enviarCorreoFactura({ correo, nombre, periodo, valorTotal, fechaVencimiento }) {
  if (!correo) return false;
  try {
    const respuesta = await enviarCorreo({
      to: correo,
      subject: `Nueva factura - periodo ${periodo} - Acueducto Campo Amor`,
      html: `<p>Hola ${escaparHtml(nombre)},</p>
             <p>Se generó tu factura del periodo <strong>${escaparHtml(periodo)}</strong> por un valor de
             <strong>$${formatearMoneda(valorTotal)}</strong>.</p>
             ${fechaVencimiento ? `<p>Fecha límite de pago: ${escaparHtml(fechaLarga(fechaVencimiento))}.</p>` : ''}
             <p>Puedes consultar el detalle desde la aplicación de Acueducto Campo Amor.</p>`,
    });
    return Boolean(respuesta);
  } catch (mailErr) {
    console.error('Error enviando correo de factura:', mailErr.message);
    return false;
  }
}

// ---------- USUARIO FINAL ----------

// Ver mis facturas
async function misFacturas(req, res) {
  const userId = req.usuario.id;

  try {
    const [resultadoFacturas, resultadoPagos] = await Promise.all([
      invoiceModel.listByProfile(userId, req.db),
      paymentModel.listByProfile(userId, req.db),
    ]);
    if (resultadoFacturas.error) return errorConsulta(res, resultadoFacturas.error);
    if (resultadoPagos.error) return errorConsulta(res, resultadoPagos.error);

    const pagosPorFactura = new Map();
    for (const pago of resultadoPagos.data || []) {
      const pagos = pagosPorFactura.get(pago.factura_id) || [];
      pagos.push(pago);
      pagosPorFactura.set(pago.factura_id, pagos);
    }
    const facturas = (resultadoFacturas.data || []).map((factura) => ({
      ...factura,
      pagos: pagosPorFactura.get(factura.id) || [],
    }));
    return res.status(200).json(facturas);
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// Solo las mensualidades de servicio sin pagar admiten plan semestral o anual.
function admitePlan(factura) {
  return ['pendiente', 'vencida'].includes(factura.estado)
    && ['servicio', 'prepago'].includes(factura.tipo);
}

// Una factura antigua (periodo fuera de AAAA-MM) o con un valor distinto a la
// tarifa se paga tal como se emitió: recalcularla cambiaría lo que se debe.
function motivoSinPlanes(factura) {
  const meses = Number(factura.meses_cubiertos) || 1;
  if (!esPeriodoValido(factura.periodo_inicio || factura.periodo)) {
    return 'Esta factura es de un periodo antiguo; se paga tal como fue emitida.';
  }
  if (Number(factura.valor_total) !== VALOR_MENSUAL * meses) {
    return 'Esta factura tiene un valor especial; se paga tal como fue emitida.';
  }
  return null;
}

// Única opción para una factura sin planes: su valor real, sin recalcular.
function opcionFacturaActual(factura) {
  const meses = Number(factura.meses_cubiertos) || 1;
  const periodoInicio = factura.periodo_inicio || factura.periodo;
  const plan = esPeriodoValido(periodoInicio) && MESES_DISPONIBLES.includes(meses)
    ? calcularPeriodosPlan(periodoInicio, meses)
    : {
      periodoInicio, periodoFin: periodoInicio, meses, periodos: [],
      proximoPeriodo: null, fechaProximaFacturacion: null,
    };
  const valorServicio = Number(factura.valor_total);
  return {
    ...plan,
    valorMensual: null,
    valorServicio,
    ...cotizarWompi(valorServicio),
    disponible: true,
    motivoNoDisponible: null,
  };
}

// Cada opción muestra lo que debe llegar limpio al acueducto (valorServicio)
// y lo que se cobra en el checkout de Wompi para cubrir su comisión.
// `periodosOcupados` son meses ya facturados en otra factura del usuario.
function opcionesPlanPago(factura, mesesDisponibles, periodosOcupados = new Set()) {
  const periodoInicio = factura.periodo_inicio || factura.periodo;
  return mesesDisponibles.map((meses) => {
    const plan = calcularPeriodosPlan(periodoInicio, Number(meses));
    const valorServicio = VALOR_MENSUAL * meses;
    const conflicto = plan.periodos.find((periodo) => periodosOcupados.has(periodo));
    return {
      ...plan,
      valorMensual: VALOR_MENSUAL,
      valorServicio,
      ...cotizarWompi(valorServicio),
      disponible: !conflicto,
      motivoNoDisponible: conflicto
        ? `Ya tienes una factura aparte de ${nombrePeriodo(conflicto)}. Paga primero esta mensualidad y luego elige el plan en esa factura.`
        : null,
    };
  });
}

async function obtenerOpcionesPlanPago(req, res) {
  try {
    const { data: factura, error } = await invoiceModel.getOwn(req.params.id, req.usuario.id, {
      columns: 'id, perfil_id, periodo, periodo_inicio, meses_cubiertos, tipo, valor_total, estado',
      db: req.db,
    });
    if (error || !factura) return res.status(404).json({ error: 'Factura no encontrada.' });
    if (!admitePlan(factura)) {
      return res.status(409).json({ error: 'Esta factura no permite elegir un plan de pago.' });
    }

    const sinPlanes = motivoSinPlanes(factura);
    if (sinPlanes) {
      return res.status(200).json({
        facturaId: factura.id,
        puedeCambiarPlan: false,
        motivoSinPlanes: sinPlanes,
        opciones: [opcionFacturaActual(factura)],
      });
    }

    const { data: pagoActivo, error: errorPagos } = await paymentModel.hasActiveByInvoice(factura.id);
    if (errorPagos) return errorConsulta(res, errorPagos);

    const mesesActuales = Number(factura.meses_cubiertos) || 1;
    const disponibles = pagoActivo ? [mesesActuales] : MESES_DISPONIBLES;
    const planMasLargo = calcularPeriodosPlan(
      factura.periodo_inicio || factura.periodo,
      Math.max(...disponibles),
    );
    const { data: ocupados, error: errorOcupados } = await invoiceModel.listCoveredPeriods(
      req.usuario.id,
      { desde: planMasLargo.periodoInicio, hasta: planMasLargo.periodoFin, exceptoFacturaId: factura.id },
    );
    if (errorOcupados) return errorConsulta(res, errorOcupados);

    return res.status(200).json({
      facturaId: factura.id,
      puedeCambiarPlan: !pagoActivo,
      motivoSinPlanes: pagoActivo
        ? 'Esta factura tiene un pago en curso. Si cerraste Wompi sin pagar, en 30 minutos podrás elegir otro plan.'
        : null,
      opciones: opcionesPlanPago(
        factura,
        disponibles,
        new Set((ocupados || []).map((fila) => fila.periodo)),
      ),
    });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

async function configurarPlanPago(req, res) {
  const meses = Number(req.body?.meses);
  if (!MESES_DISPONIBLES.includes(meses)) {
    return res.status(400).json({ error: 'El plan debe cubrir 1, 6 o 12 meses.' });
  }

  try {
    const { data: factura, error } = await invoiceModel.getOwn(req.params.id, req.usuario.id, {
      columns: 'id, perfil_id, periodo, periodo_inicio, meses_cubiertos, tipo, valor_total, estado',
      db: req.db,
    });
    if (error || !factura) return res.status(404).json({ error: 'Factura no encontrada.' });
    if (!admitePlan(factura)) {
      return res.status(409).json({ error: 'Esta factura no permite cambiar el plan.' });
    }

    const mesesActuales = Number(factura.meses_cubiertos) || 1;
    // Conservar el plan actual siempre se permite (también en facturas antiguas).
    if (mesesActuales === meses) {
      const periodoInicio = factura.periodo_inicio || factura.periodo;
      return res.status(200).json({
        factura,
        plan: esPeriodoValido(periodoInicio) ? calcularPeriodosPlan(periodoInicio, meses) : null,
        cotizacionWompi: cotizarWompi(Number(factura.valor_total)),
      });
    }
    const sinPlanes = motivoSinPlanes(factura);
    if (sinPlanes) return res.status(409).json({ error: sinPlanes });

    const { data: pagoActivo, error: errorPagos } = await paymentModel.hasActiveByInvoice(factura.id);
    if (errorPagos) return errorConsulta(res, errorPagos);
    if (pagoActivo) {
      return res.status(409).json({
        error: 'La factura tiene un pago en curso o confirmado y no se puede cambiar de plan.',
      });
    }

    const { data, error: errorPlan } = await supabaseAdmin.rpc('configurar_plan_factura', {
      p_factura_id: factura.id,
      p_perfil_id: req.usuario.id,
      p_meses: meses,
    });
    if (errorPlan) {
      console.error('[facturas] no se pudo configurar el plan:', errorPlan.message);
      const conflicto = errorPlan.code === 'P0001';
      return res.status(conflicto ? 409 : 500).json({
        error: conflicto ? errorPlan.message : 'No se pudo configurar el plan de pago.',
      });
    }
    const facturaConfigurada = Array.isArray(data) ? data[0] : data;
    if (!facturaConfigurada) {
      return res.status(409).json({ error: 'Los periodos ya están asociados a otra factura.' });
    }

    const plan = calcularPeriodosPlan(
      facturaConfigurada.periodo_inicio || facturaConfigurada.periodo,
      meses,
    );
    return res.status(200).json({
      factura: facturaConfigurada,
      plan,
      cotizacionWompi: cotizarWompi(Number(facturaConfigurada.valor_total)),
    });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// Ver una factura específica (propia)
async function verFactura(req, res) {
  const userId = req.usuario.id;
  const { id } = req.params;

  try {
    // getOwn asegura que solo vea sus propias facturas
    const { data, error } = await invoiceModel.getOwn(id, userId, { db: req.db });

    if (error) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }

    return res.status(200).json(data);
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// ---------- ADMINISTRADOR ----------

// Listar todas las facturas, con filtros opcionales ?estado= y ?perfil_id=
async function listarFacturas(req, res) {
  const { estado, perfil_id, limit, offset } = req.query;

  try {
    const { data, error } = await invoiceModel.list({ estado, perfil_id, limit, offset });
    if (error) return errorConsulta(res, error);

    return res.status(200).json(data);
  } catch (err) {
    return errorInesperado(res, err);
  }
}

async function generarFacturasMensuales(req, res) {
  const { periodo } = req.body || {};
  if (periodo !== undefined && !/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)) {
    return res.status(400).json({ error: 'El periodo debe tener el formato AAAA-MM.' });
  }

  try {
    const resumen = await ejecutarFacturacionMensual(periodo ? { periodo } : {});
    const message = `Facturación ${resumen.periodo} finalizada: ${resumen.facturasCreadas} nuevas, ${resumen.facturasExistentes} existentes, ${resumen.correosEnviados} correos enviados y ${resumen.correosFallidos} fallidos.`;
    return res.status(200).json({ message, ...resumen });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// Emitir una factura para un usuario
async function crearFactura(req, res) {
  const { perfil_id, periodo, valor_total, fecha_vencimiento, observacion, tipo } = req.body;

  if (!perfil_id || !periodo || valor_total === undefined) {
    return res.status(400).json({
      error: 'perfil_id, periodo y valor_total son obligatorios',
    });
  }

  if (!Number.isFinite(Number(valor_total)) || Number(valor_total) <= 0) {
    return res.status(400).json({ error: 'valor_total debe ser mayor que cero' });
  }

  // Los planes de pago y el cron cuentan meses con este formato.
  if ((tipo || 'servicio') === 'servicio' && !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(periodo))) {
    return res.status(400).json({ error: 'El periodo debe tener el formato AAAA-MM (por ejemplo 2026-10).' });
  }

  try {
    // Verificamos que el usuario destino exista
    const { data: perfil, error: perfilError } = await profileModel.getById(perfil_id, {
      columns: 'id, nombre, correo',
    });

    if (perfilError || !perfil) {
      return res.status(404).json({ error: 'El usuario indicado no existe' });
    }

    const { data, error } = await invoiceModel.create({
      perfil_id,
      periodo,
      valor_total,
      fecha_vencimiento,
      observacion,
      tipo,
    });

    if (error) return errorConsulta(res, error);

    await notificar(
      perfil_id,
      `Se generó tu factura del periodo ${periodo} por $${valor_total}.`,
      'factura'
    );

    const correoEnviado = await enviarCorreoFactura({
      correo: perfil.correo,
      nombre: perfil.nombre,
      periodo,
      valorTotal: valor_total,
      fechaVencimiento: fecha_vencimiento,
    });

    return res.status(201).json({
      message: correoEnviado
        ? 'Factura creada y enviada por correo.'
        : 'Factura creada, pero no se pudo enviar el correo al suscriptor.',
      correos_enviados: correoEnviado ? 1 : 0,
      correos_fallidos: correoEnviado ? 0 : 1,
      factura: data,
    });
  } catch (err) {
    return errorInesperado(res, err);
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

  if (valor_total !== undefined && !(Number(valor_total) > 0)) {
    return res.status(400).json({ error: 'valor_total debe ser mayor que cero' });
  }

  const cambios = {};
  if (estado) cambios.estado = estado;
  if (valor_total !== undefined) cambios.valor_total = Number(valor_total);
  if (fecha_vencimiento !== undefined) cambios.fecha_vencimiento = fecha_vencimiento;
  if (observacion !== undefined) cambios.observacion = observacion;

  if (Object.keys(cambios).length === 0) {
    return res.status(400).json({ error: 'No hay campos para actualizar' });
  }

  try {
    const { data, error } = await invoiceModel.update(id, cambios);

    // PGRST116: ninguna fila coincide con el id.
    if ((error && error.code === 'PGRST116') || (!error && !data)) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }
    if (error?.code === '23505') {
      return res.status(409).json({
        error: 'Ya existe otra factura activa de ese mes para el usuario; anúlala antes de reactivar esta.',
      });
    }
    if (error) return errorConsulta(res, error);

    return res.status(200).json({ message: 'Factura actualizada', factura: data });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// Eliminar una factura (solo si no tiene pagos registrados; si ya tiene
// pagos, se debe anular con actualizarFactura en vez de borrarla, para no
// perder el historial de pagos).
async function eliminarFactura(req, res) {
  const { id } = req.params;

  try {
    const { count, error: errorPagos } = await paymentModel.countByInvoice(id);

    if (errorPagos) return errorConsulta(res, errorPagos);

    if (count > 0) {
      return res.status(409).json({
        error: 'No se puede eliminar una factura con pagos registrados. Anúlala en su lugar.',
      });
    }

    const { data, error } = await invoiceModel.remove(id);

    if (error || !data) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }

    return res.status(200).json({ message: 'Factura eliminada', factura: data });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

module.exports = {
  misFacturas,
  obtenerOpcionesPlanPago,
  configurarPlanPago,
  verFactura,
  listarFacturas,
  generarFacturasMensuales,
  crearFactura,
  actualizarFactura,
  eliminarFactura,
};
