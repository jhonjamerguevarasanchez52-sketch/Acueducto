/**
 * Crea una notificación para un usuario buscándolo por nombre, apellido o
 * correo (sin necesidad de token de administrador).
 *
 *   node scripts/crearNotificacion.js <nombre|correo|perfil_id> "<mensaje>" [tipo]
 *
 * Ejemplo:
 *   node scripts/crearNotificacion.js deimer "Tu servicio está próximo a un corte." corte
 */
require('dotenv').config();
const supabaseAdmin = require('../config/supabaseAdminClient');

async function resolverPerfil(entrada) {
  const esUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entrada);

  if (esUuid) {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('id, nombre, apellido, correo')
      .eq('id', entrada)
      .single();
    return data ? [data] : [];
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, nombre, apellido, correo')
    .or(`nombre.ilike.%${entrada}%,apellido.ilike.%${entrada}%,correo.ilike.%${entrada}%`);

  if (error) return [];
  return data || [];
}

async function main() {
  const entrada = process.argv[2];
  const mensaje = process.argv[3];
  const tipo = process.argv[4] || 'general';

  if (!entrada || !mensaje) {
    console.error('Uso: node scripts/crearNotificacion.js <nombre|correo|perfil_id> "<mensaje>" [tipo]');
    process.exit(1);
  }

  const perfiles = await resolverPerfil(entrada);

  if (perfiles.length === 0) {
    console.error(`No encontré ningún usuario que coincida con "${entrada}".`);
    process.exit(1);
  }

  if (perfiles.length > 1) {
    console.error(`Hay ${perfiles.length} usuarios que coinciden con "${entrada}", sé más específico:`);
    perfiles.forEach((p) => console.error(`  - ${p.nombre} ${p.apellido} <${p.correo}> (${p.id})`));
    process.exit(1);
  }

  const perfil = perfiles[0];

  const { data, error } = await supabaseAdmin
    .from('notifications')
    .insert({
      perfil_id: perfil.id,
      mensaje,
      tipo,
      estado: 'no_leido',
      fecha: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('No se pudo crear la notificación ❌');
    console.error(error.message);
    process.exit(1);
  }

  console.log('Notificación creada ✅');
  console.log('---');
  console.log('Usuario         :', `${perfil.nombre} ${perfil.apellido} <${perfil.correo}>`);
  console.log('Notificación id :', data.id);
  console.log('Mensaje         :', data.mensaje);
  console.log('Tipo            :', data.tipo);
  console.log('Fecha           :', data.fecha);
}

main().catch((err) => {
  console.error('Falló la creación de la notificación ❌');
  console.error(err.message || err);
  process.exit(1);
});
