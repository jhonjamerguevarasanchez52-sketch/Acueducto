/**
 * Recorre `items` ejecutando `fn` con a lo sumo `limite` llamadas a la vez y
 * devuelve los resultados en el mismo orden. Sirve para no disparar cientos
 * de peticiones simultáneas a un servicio externo (por ejemplo, Brevo).
 */
async function mapearConLimite(items, limite, fn) {
  const resultados = new Array(items.length);
  let siguiente = 0;

  async function trabajador() {
    while (siguiente < items.length) {
      const indice = siguiente;
      siguiente += 1;
      resultados[indice] = await fn(items[indice], indice);
    }
  }

  const cantidad = Math.max(1, Math.min(limite, items.length));
  await Promise.all(Array.from({ length: cantidad }, trabajador));
  return resultados;
}

module.exports = { mapearConLimite };
