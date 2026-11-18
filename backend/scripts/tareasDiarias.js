require('dotenv').config();
const { ejecutarTareasDiarias } = require('../services/tareasProgramadas');

// Corre a mano las mismas tareas que pg_cron dispara cada día:
//   npm run tareas-diarias
async function main() {
  const resumen = await ejecutarTareasDiarias();
  console.log(JSON.stringify(resumen, null, 2));
  if (resumen.errores.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error('[tareas-diarias] La tarea no pudo completarse:', error.message);
  process.exitCode = 1;
});
