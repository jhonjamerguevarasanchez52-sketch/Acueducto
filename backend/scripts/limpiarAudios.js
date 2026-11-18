require('dotenv').config();
const { limpiarAudiosVencidos } = require('../services/audiosAveriaService');

// Uso manual: npm run limpiar-audios. En producción la misma limpieza corre
// cada hora desde pg_cron (ver migración 20261029_audios_averias.sql).
async function main() {
  const resumen = await limpiarAudiosVencidos();
  console.log(`Audios borrados: ${resumen.borrados}`);
  for (const error of resumen.errores) console.error(`[limpiar-audios] ${error}`);
  if (resumen.errores.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error('[limpiar-audios] La tarea no pudo completarse:', error.message);
  process.exitCode = 1;
});
