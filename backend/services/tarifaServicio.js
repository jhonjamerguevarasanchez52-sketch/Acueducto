const supabaseAdmin = require('../config/supabaseAdminClient');
const rateModel = require('../models/rateModel');
const { fechaBogota } = require('../utils/fechas');

// Valor de respaldo si el administrador todavía no registró ninguna tarifa
// residencial vigente. Solo se usa para no frenar la facturación; el resumen
// avisa que se usó este valor para que el administrador cree la tarifa.
const VALOR_MENSUAL_POR_DEFECTO = 12000;

/**
 * Cuota mensual residencial vigente en `fecha` (AAAA-MM-DD, hora de Colombia).
 * Es la misma tarifa que el administrador edita en el panel y la que GOTA le
 * muestra al usuario, así que la factura y el asistente nunca se contradicen.
 *
 * @returns {Promise<{ valor: number, origen: 'tarifa' | 'defecto', tarifaId: string | null }>}
 */
async function valorMensualVigente(fecha = fechaBogota(), { db = supabaseAdmin } = {}) {
  try {
    const { data, error } = await rateModel.getCurrent(fecha, { columns: 'id, cuota_fija', db });
    const valor = Number(data?.cuota_fija);
    if (!error && Number.isFinite(valor) && valor > 0) {
      return { valor, origen: 'tarifa', tarifaId: data.id };
    }
  } catch (err) {
    console.error('[tarifa] no se pudo leer la tarifa vigente:', err.message);
  }
  return { valor: VALOR_MENSUAL_POR_DEFECTO, origen: 'defecto', tarifaId: null };
}

// Tarifa que aplica a un periodo AAAA-MM: la vigente el primer día de ese mes.
function valorMensualDePeriodo(periodo, opciones) {
  return valorMensualVigente(`${periodo}-01`, opciones);
}

module.exports = { VALOR_MENSUAL_POR_DEFECTO, valorMensualVigente, valorMensualDePeriodo };
