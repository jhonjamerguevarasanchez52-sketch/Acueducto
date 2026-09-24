const profileModel = require('../models/profileModel');
const facturaExtraordinariaModel = require('../models/facturaextraordinariaModel');
const { notificar } = require('../utils/notificar');
const { errorInesperado, errorConsulta } = require('../utils/httpErrores');

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
          `Se generó una cuota extraordinaria de $${valor_total} por concepto de ${concepto}.`,
          'cuota_extraordinaria'
        )
      )
    );

    return res.status(201).json({
      message: 'Factura extraordinaria creada',
      concepto,
      usuarios_afectados: perfilesSeleccionados.length,
      facturas: data,
    });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

module.exports = { crearFacturaExtraordinaria };