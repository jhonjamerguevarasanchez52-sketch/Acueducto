/**
 * Aplica paginación opcional (?limit=&offset=) a una consulta de Supabase.
 * Si no se pasa `limit`, la consulta se ejecuta igual que antes (sin
 * recorte), para no romper a los clientes que ya esperan el arreglo
 * completo en la respuesta.
 *
 * Al paginar se agrega `id` como segundo criterio de orden: si dos filas
 * comparten la fecha del orden principal, sin ese desempate una fila podría
 * repetirse o saltarse entre una página y la siguiente.
 *
 * Supabase nunca devuelve más de 1000 filas por consulta (max_rows), así que
 * el límite pedido se recorta a ese valor.
 */
const LIMITE_MAXIMO = 1000;

function aplicarPaginacion(query, { limit, offset } = {}) {
  const limiteNum = Math.floor(Number(limit));
  if (!Number.isFinite(limiteNum) || limiteNum <= 0) return query;

  const limite = Math.min(limiteNum, LIMITE_MAXIMO);
  const offsetNum = Number(offset) > 0 ? Math.floor(Number(offset)) : 0;
  return query
    .order('id', { ascending: true })
    .range(offsetNum, offsetNum + limite - 1);
}

module.exports = { aplicarPaginacion, LIMITE_MAXIMO };
