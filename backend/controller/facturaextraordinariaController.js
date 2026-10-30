const profileModel = require('../models/profileModel');
const facturaExtraordinariaModel = require('../models/facturaextraordinariaModel');
const { notificar } = require('../utils/notificar');
const { enviarCorreo } = require('../config/mailer');
const { escaparHtml } = require('../utils/html');
const { errorInesperado, errorConsulta } = require('../utils/httpErrores');

function formatearMoneda(valor) {
  return Number(valor).toLocaleString('es-CO');
}

function formatearFecha(valor) {
  if (!valor) return '';
  const fecha = new Date(`${String(valor).slice(0, 10)}T12:00:00`);
  return Number.isNaN(fecha.getTime()) ? '' : fecha.toLocaleDateString('es-CO');
}

async function crearFacturaExtraordinaria(req, res) {
  const { periodo, valor_total, concepto, fecha_vencimiento, perfil_ids } = req.body;

  if (!periodo || valor_total === undefined || !concepto) {
    return res.status(400).json({
      error: 'periodo, valor_total y concepto son obligatorios',
    });
  }

  if (!Number.isFinite(Number(valor_total)) || Number(valor_total) <= 0) {
    return res.status(400).json({ error: 'valor_total debe ser mayor que cero' });
  }

  if (perfil_ids !== undefined && (!Array.isArray(perfil_ids) || perfil_ids.length === 0)) {
    return res.status(400).json({ error: 'perfil_ids debe ser un arreglo no vacío' });
  }

  try {
    const { data: perfiles, error: perfilesError } = await profileModel.listActiveForBilling();

    if (perfilesError) return errorConsulta(res, perfilesError);

    const perfilesSeleccionados = perfil_ids
      ? perfiles.filter((perfil) => perfil_ids.includes(perfil.id))
      : perfiles;

    if (perfilesSeleccionados.length === 0) {
      return res.status(404).json({ error: 'No hay usuarios activos seleccionados' });
    }

    const { data, error } = await facturaExtraordinariaModel.createForProfiles({
      perfilIds: perfilesSeleccionados.map(({ id }) => id),
      periodo,
      valorTotal: Number(valor_total),
      concepto,
      fechaVencimiento: fecha_vencimiento,
    });

    if (error) return errorConsulta(res, error);

    await Promise.all(
      perfilesSeleccionados.map((perfil) =>
        notificar(
          perfil.id,
          `Se generó una cuota extraordinaria de $${formatearMoneda(valor_total)} por concepto de ${concepto}.`,
          'cuota_extraordinaria'
        )
      )
    );

    const facturasPorPerfil = new Map((data || []).map((factura) => [factura.perfil_id, factura]));
    const resultadosCorreo = await Promise.all(perfilesSeleccionados.map(async (perfil) => {
      if (!perfil.correo) return false;
      const factura = facturasPorPerfil.get(perfil.id);
      try {
        const respuesta = await enviarCorreo({
          to: perfil.correo,
          subject: `Factura extraordinaria ${periodo} - Acueducto Campo Amor`,
          html: `<p>Hola ${escaparHtml(perfil.nombre || '')},</p>
                 <p>Se generó una factura extraordinaria para el periodo <strong>${escaparHtml(periodo)}</strong>.</p>
                 <p><strong>Concepto:</strong> ${escaparHtml(concepto)}<br>
                 <strong>Valor:</strong> $${formatearMoneda(valor_total)}<br>
                 ${fecha_vencimiento ? `<strong>Fecha límite de pago:</strong> ${formatearFecha(fecha_vencimiento)}<br>` : ''}
                 <strong>Número de factura:</strong> ${escaparHtml(factura?.numero_factura || factura?.id || '')}</p>
                 <p>Puedes consultar el detalle desde la aplicación del Acueducto Campo Amor.</p>`,
        });
        if (!respuesta) throw new Error('El servicio de correo no confirmó el envío.');
        return true;
      } catch (errorCorreo) {
        console.error(`[factura extraordinaria] No se pudo enviar correo a ${perfil.correo}:`, errorCorreo.message);
        return false;
      }
    }));
    const correosEnviados = resultadosCorreo.filter(Boolean).length;
    const correosFallidos = resultadosCorreo.length - correosEnviados;

    return res.status(201).json({
      message: `Se generaron ${data.length} factura${data.length === 1 ? '' : 's'} extraordinaria${data.length === 1 ? '' : 's'} para ${perfilesSeleccionados.length} usuario${perfilesSeleccionados.length === 1 ? '' : 's'}. Correos enviados: ${correosEnviados}; fallidos: ${correosFallidos}.`,
      concepto,
      usuarios_afectados: perfilesSeleccionados.length,
      correos_enviados: correosEnviados,
      correos_fallidos: correosFallidos,
      facturas: data,
    });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

module.exports = { crearFacturaExtraordinaria };
