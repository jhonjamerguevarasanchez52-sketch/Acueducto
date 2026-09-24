/**
 * Aplica paginación opcional (?limit=&offset=) a una consulta de Supabase.
 * Si no se pasa `limit`, la consulta se ejecuta igual que antes (sin
 * recorte), para no romper a los clientes que ya esperan el arreglo
 * completo en la respuesta.
 */
function aplicarPaginacion(query, { limit, offset } = {}) {
  const limiteNum = Number(limit);
  if (!Number.isFinite(limiteNum) || limiteNum <= 0) return query;

  const offsetNum = Number(offset) > 0 ? Number(offset) : 0;
  return query.range(offsetNum, offsetNum + limiteNum - 1);
}

module.exports = { aplicarPaginacion };
