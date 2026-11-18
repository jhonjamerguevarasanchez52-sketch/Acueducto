const express = require('express');
const router = express.Router();
const { verificarTarea } = require('../middleware/tareasMiddleware');
const { ejecutarTareasDiarias } = require('../services/tareasProgramadas');
const { errorInesperado } = require('../utils/httpErrores');

// Resumen en una frase para el panel administrativo.
function describirResumen({ facturacion, vencidas, recordatorios, errores }) {
  const partes = [];
  if (facturacion) {
    partes.push(`Facturación ${facturacion.periodo}: ${facturacion.creadas} nuevas y ${facturacion.existentes} existentes`);
  } else {
    partes.push('Hoy no corresponde facturar (solo días 1 a 5)');
  }
  partes.push(`${vencidas} factura(s) marcadas como vencidas`);
  if (recordatorios) partes.push(`${recordatorios.recordatorios} recordatorio(s) enviados`);
  if (errores.length) partes.push(`${errores.length} error(es): revisa los registros del servidor`);
  return `${partes.join('. ')}.`;
}

// Factura (días 1 a 5), vence facturas atrasadas y envía recordatorios.
router.post('/diarias', verificarTarea, async (req, res) => {
  try {
    const resumen = await ejecutarTareasDiarias();
    if (resumen.errores.length) console.error('[tareas] errores:', resumen.errores);
    return res.status(200).json({ message: describirResumen(resumen), ...resumen });
  } catch (err) {
    return errorInesperado(res, err);
  }
});

module.exports = router;
