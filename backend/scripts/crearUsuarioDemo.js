/**
 * Crea (o repara) un usuario listo para iniciar sesión y le monta datos de
 * ejemplo en cada módulo de la app: facturas, pagos, estado del servicio
 * (cortes), averías y notificaciones.
 *
 *   node scripts/crearUsuarioDemo.js [correo] [password] [nombre] [apellido] [--cortado]
 *
 * Ejemplos:
 *   node scripts/crearUsuarioDemo.js
 *   node scripts/crearUsuarioDemo.js demo@campoamor.com "Demo*2026" Ana Torres
 *   node scripts/crearUsuarioDemo.js demo@campoamor.com "Demo*2026" Ana Torres --cortado
 *
 * - Sin --cortado el servicio queda activo (con un corte antiguo ya reconectado
 *   en el historial). Con --cortado queda un corte activo ligado a la factura
 *   vencida.
 * - Si el usuario ya existía, BORRA sus facturas, pagos, averías, cortes y
 *   notificaciones antes de volver a sembrar, para que el script se pueda
 *   re-ejecutar sin duplicar datos. Úsalo solo con cuentas de prueba.
 */
require('dotenv').config();
const supabaseAdmin = require('../config/supabaseAdminClient');

const CORREO_POR_DEFECTO = 'demo@campoamor.com';
const PASSWORD_POR_DEFECTO = 'Demo*2026';

async function buscarUsuarioAuthPorCorreo(correo) {
  // No hay getUserByEmail en la API admin: paginamos hasta encontrarlo.
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const encontrado = data.users.find((u) => (u.email || '').toLowerCase() === correo);
    if (encontrado) return encontrado;
    if (data.users.length < 200) break;
  }
  return null;
}

// Fecha relativa a hoy (días negativos = pasado).
function diasDesdeHoy(dias) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d;
}

function periodoDe(fecha) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
}

function soloFecha(fecha) {
  return fecha.toISOString().split('T')[0];
}

async function crearOReparaUsuario({ correo, password, nombre, apellido }) {
  let userId;
  let yaExistia = false;

  const { data: creado, error: crearError } = await supabaseAdmin.auth.admin.createUser({
    email: correo,
    password,
    email_confirm: true,
  });

  if (crearError) {
    if (!/already been registered|already exists|duplicate/i.test(crearError.message)) throw crearError;

    const existente = await buscarUsuarioAuthPorCorreo(correo);
    if (!existente) throw new Error('El correo ya está registrado en Auth pero no pude localizar su id.');
    userId = existente.id;
    yaExistia = true;

    const { error: updError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });
    if (updError) throw updError;
    console.log(`El usuario ya existía en Auth (${userId}). Contraseña actualizada.`);
  } else {
    userId = creado.user.id;
    console.log(`Usuario creado en Auth: ${userId}`);
  }

  const { error: perfilError } = await supabaseAdmin.from('profiles').upsert(
    {
      id: userId,
      nombre,
      apellido,
      correo,
      rol: 'usuario',
      activo: true,
      is_verified: true,
      debe_cambiar_password: false,
      codigo_verificacion: null,
      codigo_verificacion_expiracion: null,
      telefono: '3001234567',
      numero_lote: 'L-087',
      direccion: 'Vereda Campo Amor, casa 87',
      ocupacion: 'Agricultor',
      zona: 'Zona Alta',
    },
    { onConflict: 'id' },
  );
  if (perfilError) throw perfilError;

  return { userId, yaExistia };
}

async function limpiarDatos(perfilId) {
  // El orden importa por las llaves foráneas (pagos y cortes apuntan a facturas).
  for (const tabla of ['payments', 'service_outages', 'breakdowns', 'invoices', 'notifications']) {
    const { error } = await supabaseAdmin.from(tabla).delete().eq('perfil_id', perfilId);
    if (error) throw new Error(`No pude limpiar "${tabla}": ${error.message}`);
  }
  console.log('Datos anteriores del usuario eliminados.');
}

// La base real puede no tener todas las columnas de db/schema.sql (p. ej. los
// ALTER no se aplicaron): si Supabase avisa que falta una, la quitamos y
// reintentamos.
async function insertar(tabla, filas) {
  for (;;) {
    const { data, error } = await supabaseAdmin.from(tabla).insert(filas).select();
    if (!error) return data;

    const faltante = /Could not find the '(\w+)' column/.exec(error.message);
    if (!faltante) throw new Error(`No pude insertar en "${tabla}": ${error.message}`);

    const columna = faltante[1];
    console.warn(`  (aviso) "${tabla}" no tiene la columna "${columna}"; la omito.`);
    filas = filas.map(({ [columna]: _omitida, ...resto }) => resto);
  }
}

const insertarFacturas = (filas) => insertar('invoices', filas);

async function sembrarDatos(perfilId, { cortado }) {
  const hace3Meses = diasDesdeHoy(-90);
  const hace2Meses = diasDesdeHoy(-60);
  const haceUnMes = diasDesdeHoy(-30);
  const hoy = new Date();

  // ---------- Facturas ----------
  const [fPagadaEfectivo, fPagadaWompi, fVencida, fPendiente, fExtra] = await insertarFacturas([
    {
      perfil_id: perfilId,
      periodo: periodoDe(hace3Meses),
      tipo: 'servicio',
      valor_total: 15000,
      estado: 'pendiente', // pasa a 'pagada' tras registrar su pago (ver abajo)
      fecha_emision: hace3Meses.toISOString(),
      fecha_vencimiento: soloFecha(diasDesdeHoy(-75)),
    },
    {
      perfil_id: perfilId,
      periodo: periodoDe(hace2Meses),
      tipo: 'servicio',
      valor_total: 15000,
      estado: 'pendiente', // pasa a 'pagada' tras registrar su pago (ver abajo)
      fecha_emision: hace2Meses.toISOString(),
      fecha_vencimiento: soloFecha(diasDesdeHoy(-45)),
    },
    {
      perfil_id: perfilId,
      periodo: periodoDe(haceUnMes),
      tipo: 'servicio',
      valor_total: 15000,
      estado: 'vencida',
      fecha_emision: haceUnMes.toISOString(),
      fecha_vencimiento: soloFecha(diasDesdeHoy(-15)),
    },
    {
      perfil_id: perfilId,
      periodo: periodoDe(hoy),
      tipo: 'servicio',
      valor_total: 15000,
      estado: 'pendiente',
      fecha_emision: hoy.toISOString(),
      fecha_vencimiento: soloFecha(diasDesdeHoy(15)),
    },
    {
      perfil_id: perfilId,
      // La base exige un periodo único por usuario, así que la extraordinaria
      // no puede compartir periodo con la factura del mes.
      periodo: `${periodoDe(hoy)}-EXT`,
      tipo: 'extraordinaria',
      valor_total: 30000,
      estado: 'pendiente',
      fecha_emision: hoy.toISOString(),
      fecha_vencimiento: soloFecha(diasDesdeHoy(30)),
      observacion: 'Cuota extraordinaria: Mantenimiento del tanque de almacenamiento',
    },
  ]);
  console.log('Facturas creadas: 2 pagadas, 1 vencida, 1 pendiente, 1 extraordinaria.');

  // ---------- Pagos ----------
  await insertar('payments', [
    {
      factura_id: fPagadaEfectivo.id,
      perfil_id: perfilId,
      monto: 15000,
      metodo: 'efectivo',
      referencia: 'REC-0001',
      confirmado: true,
      fecha_pago: diasDesdeHoy(-80).toISOString(),
      fecha_confirmacion: diasDesdeHoy(-80).toISOString(),
      metodo_confirmacion: 'manual',
    },
    {
      factura_id: fPagadaWompi.id,
      perfil_id: perfilId,
      monto: 15000,
      metodo: 'tarjeta',
      referencia: `DEMO-${Date.now()}`,
      confirmado: true,
      fecha_pago: diasDesdeHoy(-50).toISOString(),
      fecha_confirmacion: diasDesdeHoy(-50).toISOString(),
      metodo_confirmacion: 'wompi',
      estado_wompi: 'APPROVED',
      transaccion_id: `demo-tx-${Date.now()}`,
    },
    {
      // Pago reportado por el usuario que el administrador aún no confirma.
      factura_id: fPendiente.id,
      perfil_id: perfilId,
      monto: 15000,
      metodo: 'transferencia',
      referencia: 'TRF-DEMO-123',
      confirmado: false,
      fecha_pago: diasDesdeHoy(-1).toISOString(),
    },
  ]);

  // Un trigger de la BD rechaza pagos confirmados sobre facturas ya pagadas,
  // así que las marcamos como pagadas después de registrar el pago.
  const { error: pagadaError } = await supabaseAdmin
    .from('invoices')
    .update({ estado: 'pagada' })
    .in('id', [fPagadaEfectivo.id, fPagadaWompi.id]);
  if (pagadaError) throw new Error(`No pude marcar facturas como pagadas: ${pagadaError.message}`);

  console.log('Pagos creados: 2 confirmados, 1 por confirmar.');

  // ---------- Estado del servicio (cortes) ----------
  const cortes = [
    {
      perfil_id: perfilId,
      motivo: 'Mantenimiento programado de la red',
      estado: 'reconectado',
      fecha_corte: diasDesdeHoy(-120).toISOString(),
      fecha_reconexion: diasDesdeHoy(-119).toISOString(),
    },
  ];
  if (cortado) {
    cortes.push({
      perfil_id: perfilId,
      factura_id: fVencida.id,
      motivo: `Factura vencida del periodo ${fVencida.periodo}`,
      estado: 'activo',
      fecha_corte: diasDesdeHoy(-2).toISOString(),
    });
  }
  await insertar('service_outages', cortes);
  console.log(cortado ? 'Servicio: CORTADO (corte activo por factura vencida).' : 'Servicio: ACTIVO (con 1 corte antiguo ya reconectado).');

  // ---------- Averías ----------
  await insertar('breakdowns', [
    {
      perfil_id: perfilId,
      descripcion: 'Fuga de agua en la tubería frente a la casa',
      zona: 'Zona Alta',
      estado: 'resuelta',
      nota_fontanero: 'Se cambió el tramo de tubería dañado.',
      fecha_reporte: diasDesdeHoy(-40).toISOString(),
      fecha_resolucion: diasDesdeHoy(-38).toISOString(),
    },
    {
      perfil_id: perfilId,
      descripcion: 'Baja presión de agua en las mañanas',
      zona: 'Zona Alta',
      estado: 'reportada',
      fecha_reporte: diasDesdeHoy(-3).toISOString(),
    },
  ]);
  console.log('Averías creadas: 1 resuelta, 1 reportada.');

  // ---------- Notificaciones ----------
  // (Un trigger de la BD ya crea avisos al insertar facturas; estas se suman.)
  const notificaciones = [
    { mensaje: '¡Bienvenido a HidroApp! Aquí podrás consultar tus facturas y pagos.', tipo: 'general', estado: 'leido', fecha: diasDesdeHoy(-90) },
    { mensaje: 'Tu pago de $15.000 fue confirmado. ¡Gracias!', tipo: 'pago', estado: 'leido', fecha: diasDesdeHoy(-50) },
    { mensaje: `Tu factura del periodo ${fVencida.periodo} está vencida. Evita la suspensión del servicio.`, tipo: 'factura', estado: 'no_leido', fecha: diasDesdeHoy(-14) },
    { mensaje: 'Tu reporte de avería fue recibido y será atendido por el fontanero.', tipo: 'averia', estado: 'no_leido', fecha: diasDesdeHoy(-3) },
    { mensaje: 'Se generó una cuota extraordinaria de $30.000 para el mantenimiento del tanque.', tipo: 'factura', estado: 'no_leido', fecha: hoy },
  ];
  if (cortado) {
    notificaciones.push({ mensaje: `Tu servicio de agua fue suspendido. Motivo: Factura vencida del periodo ${fVencida.periodo}.`, tipo: 'corte', estado: 'no_leido', fecha: diasDesdeHoy(-2) });
  }
  await insertar(
    'notifications',
    notificaciones.map((n) => ({ ...n, perfil_id: perfilId, fecha: n.fecha.toISOString() })),
  );
  console.log(`Notificaciones creadas: ${notificaciones.length} (más las que genere el trigger de facturas).`);
}

async function main() {
  const args = process.argv.slice(2);
  const cortado = args.includes('--cortado');
  const [correoArg, passwordArg, nombreArg, apellidoArg] = args.filter((a) => a !== '--cortado');

  const correo = String(correoArg || CORREO_POR_DEFECTO).toLowerCase().trim();
  const password = passwordArg || PASSWORD_POR_DEFECTO;
  const nombre = nombreArg || 'Usuario';
  const apellido = apellidoArg || 'Demo';

  if (String(password).length < 8) {
    console.error('La contraseña debe tener al menos 8 caracteres.');
    process.exit(1);
  }

  const { userId, yaExistia } = await crearOReparaUsuario({ correo, password, nombre, apellido });
  if (yaExistia) await limpiarDatos(userId);
  await sembrarDatos(userId, { cortado });

  console.log('---');
  console.log('Usuario de prueba listo ✅');
  console.log('Correo   :', correo);
  console.log('Password :', password);
  console.log('Nombre   :', `${nombre} ${apellido}`);
  console.log('Ya puede iniciar sesión en la app.');
}

main().catch((err) => {
  console.error('Falló la creación del usuario de prueba ❌');
  console.error(err.message || err);
  process.exit(1);
});
