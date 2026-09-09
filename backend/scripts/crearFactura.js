/**
 * Emite una factura para un usuario, sin necesidad de un token de administrador
 * (hace lo mismo que POST /api/facturas: inserta en "invoices" y notifica).
 *
 *   node scripts/crearFactura.js <correo|perfil_id> [valor_total] [periodo] [dias_para_vencer]
 *
 * Ejemplos:
 *   node scripts/crearFactura.js guevarasanchezjhonjamer99@gmail.com
 *   node scripts/crearFactura.js persona@correo.com 18000 2026-09 15
 *
 * - Si no se pasa valor_total, usa la cuota fija de la tarifa residencial
 *   vigente; si tampoco hay tarifa, usa 15000.
 * - Si no se pasa periodo, usa el mes actual en formato AAAA-MM.
 * - dias_para_vencer por defecto: 15.
 *
 * La tabla "invoices" no tiene columna de observación, así que este script no
 * la envía (a diferencia de POST /api/facturas, que sí la manda y falla).
 */
require('dotenv').config();
const supabaseAdmin = require('../config/supabaseAdminClient');

const VALOR_POR_DEFECTO = 15000;

function periodoActual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function resolverPerfilId(entrada) {
  const esUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entrada);
  const filtro = esUuid ? 'id' : 'correo';
  const valor = esUuid ? entrada : entrada.toLowerCase().trim();

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, nombre, apellido, correo')
    .eq(filtro, valor)
    .single();

  if (error || !data) return null;
  return data;
}

async function cuotaVigente() {
  const hoy = new Date().toISOString().split('T')[0];
  const { data } = await supabaseAdmin
    .from('rates')
    .select('cuota_fija')
    .eq('tipo', 'residencial')
    .lte('vigente_desde', hoy)
    .or(`vigente_hasta.is.null,vigente_hasta.gte.${hoy}`)
    .order('vigente_desde', { ascending: false })
    .limit(1)
    .single();
  return data && Number.isFinite(Number(data.cuota_fija))
    ? Number(data.cuota_fija)
    : null;
}

async function main() {
  const entrada = process.argv[2];
  if (!entrada) {
    console.error('Uso: node scripts/crearFactura.js <correo|perfil_id> [valor_total] [periodo] [dias_para_vencer] [observacion]');
    process.exit(1);
  }

  const perfil = await resolverPerfilId(entrada);
  if (!perfil) {
    console.error(`No encontré ningún usuario con "${entrada}".`);
    process.exit(1);
  }

  const valorArg = process.argv[3];
  let valorTotal;
  if (valorArg !== undefined) {
    valorTotal = Number(valorArg);
  } else {
    valorTotal = (await cuotaVigente()) ?? VALOR_POR_DEFECTO;
  }

  if (!Number.isFinite(valorTotal) || valorTotal <= 0) {
    console.error('valor_total debe ser un número mayor que cero.');
    process.exit(1);
  }

  const periodo = process.argv[4] || periodoActual();
  const diasVencer = Number(process.argv[5] || 15);

  const fechaEmision = new Date();
  const fechaVencimiento = new Date(fechaEmision);
  fechaVencimiento.setDate(fechaVencimiento.getDate() + diasVencer);

  const { data, error } = await supabaseAdmin
    .from('invoices')
    .insert({
      perfil_id: perfil.id,
      periodo,
      valor_total: valorTotal,
      estado: 'pendiente',
      fecha_emision: fechaEmision.toISOString(),
      fecha_vencimiento: fechaVencimiento.toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('No se pudo crear la factura ❌');
    console.error(error.message);
    process.exit(1);
  }

  // La notificación al usuario la crea un trigger de la BD al insertar la fila.

  console.log('Factura creada ✅');
  console.log('---');
  console.log('Usuario     :', `${perfil.nombre} ${perfil.apellido} <${perfil.correo}>`);
  console.log('Factura id  :', data.id);
  console.log('Periodo     :', periodo);
  console.log('Valor total :', valorTotal);
  console.log('Estado      :', data.estado);
  console.log('Emisión     :', data.fecha_emision);
  console.log('Vencimiento :', data.fecha_vencimiento);
}

main().catch((err) => {
  console.error('Falló la creación de la factura ❌');
  console.error(err.message || err);
  process.exit(1);
});
