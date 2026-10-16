require('dotenv').config();
const { generarFacturasMensuales } = require('../services/facturacionMensual');

async function main() {
  const periodo = process.argv[2];
  const resumen = await generarFacturasMensuales(periodo ? { periodo } : {});

  console.log(`Facturación mensual completada para ${resumen.periodo}.`);
  console.log(`Valor por usuario: $${resumen.valorPorFactura.toLocaleString('es-CO')}`);
  console.log(`Usuarios activos: ${resumen.usuariosActivos}`);
  console.log(`Facturas creadas: ${resumen.facturasCreadas}`);
  console.log(`Facturas ya existentes: ${resumen.facturasExistentes}`);
  console.log(`Correos enviados: ${resumen.correosEnviados}`);
  console.log(`Correos fallidos: ${resumen.correosFallidos}`);

  for (const error of resumen.errores) {
    console.error(`[facturacion-mensual] ${error}`);
  }

  if (resumen.errores.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error('[facturacion-mensual] La tarea no pudo completarse:', error.message);
  process.exitCode = 1;
});
