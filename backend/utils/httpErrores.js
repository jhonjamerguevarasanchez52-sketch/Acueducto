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

// Errores de Postgres causados por datos del cliente, no por el servidor:
// se responden como 4xx con un mensaje claro en vez de un 500.
const ERRORES_DE_DATOS = {
  '22P02': [400, 'Algún identificador o dato tiene un formato inválido.'],
  '22001': [400, 'Algún texto supera la longitud permitida.'],
  '22003': [400, 'Algún valor numérico está fuera de rango.'],
  '22007': [400, 'Alguna fecha tiene un formato inválido.'],
  '22008': [400, 'Alguna fecha está fuera de rango.'],
  '23502': [400, 'Falta un dato obligatorio.'],
  '23503': [409, 'El registro relacionado no existe o todavía está en uso.'],
  '23505': [409, 'Ya existe un registro con esos datos.'],
  '23514': [400, 'Algún dato no cumple las reglas permitidas.'],
};

// Para errores devueltos directamente por una consulta a Supabase/PostgREST.
function errorConsulta(res, error, status = 500) {
  console.error(error);
  const deDatos = status === 500 && ERRORES_DE_DATOS[error?.code];
  if (deDatos) return res.status(deDatos[0]).json({ error: deDatos[1] });
  const mensaje = esProduccion() ? 'Error interno del servidor' : error.message;
  return res.status(status).json({ error: mensaje });
}

module.exports = { errorInesperado, errorConsulta };
