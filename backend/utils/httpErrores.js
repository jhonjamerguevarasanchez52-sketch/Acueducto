/**
 * Respuestas de error centralizadas para no filtrar detalles internos
 * (mensajes de Postgres/PostgREST, stack traces) al cliente en producción,
 * a la vez que se conservan en los logs del servidor para depurar.
 */
const esProduccion = () => process.env.NODE_ENV === 'production';

// Para excepciones no controladas (bloques catch de los controladores).
function errorInesperado(res, err, status = 500) {
  console.error(err);
  const body = { error: 'Error inesperado' };
  if (!esProduccion()) body.detalle = err.message;
  return res.status(status).json(body);
}

// Para errores devueltos directamente por una consulta a Supabase/PostgREST.
function errorConsulta(res, error, status = 500) {
  console.error(error);
  const mensaje = esProduccion() ? 'Error interno del servidor' : error.message;
  return res.status(status).json({ error: mensaje });
}

module.exports = { errorInesperado, errorConsulta };
