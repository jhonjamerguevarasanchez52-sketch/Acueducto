const { randomUUID } = require('crypto');
const supabaseAdmin = require('../config/supabaseAdminClient');
const { crearBucketPrivado } = require('../utils/bucketPrivado');

const BUCKET = 'payment-receipts';
const MAX_BYTES = 5 * 1024 * 1024;
const MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const asegurarBucketPrivado = crearBucketPrivado(BUCKET, {
  fileSizeLimit: MAX_BYTES,
  allowedMimeTypes: MIME_TYPES,
});

async function subirRecibo({ perfilId, facturaId, bytes, contentType }) {
  await asegurarBucketPrivado();
  const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[contentType];
  const path = `${perfilId}/${facturaId}/${randomUUID()}.${extension}`;
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType, upsert: false, cacheControl: '3600' });

  return { path: data?.path || path, error };
}

// Enlaces temporales para muchos recibos a la vez: una llamada a Storage por
// cada bloque de 100 en vez de una por recibo. Devuelve un Map ruta → enlace;
// una ruta que falla queda con null.
const LOTE_ENLACES = 100;

async function crearUrlsRecibos(paths = []) {
  const unicos = [...new Set(paths.filter(Boolean))];
  const enlaces = new Map();
  if (unicos.length === 0) return enlaces;

  await asegurarBucketPrivado();
  for (let i = 0; i < unicos.length; i += LOTE_ENLACES) {
    const lote = unicos.slice(i, i + LOTE_ENLACES);
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrls(lote, 10 * 60);
    if (error) throw error;
    for (const item of data || []) {
      enlaces.set(item.path, item.error ? null : item.signedUrl || null);
    }
  }
  return enlaces;
}

async function eliminarRecibo(path) {
  if (!path) return;
  const { error } = await supabaseAdmin.storage.from(BUCKET).remove([path]);
  if (error) console.error('[pagos] no se pudo limpiar un recibo sin pago asociado:', error.message);
}

module.exports = {
  BUCKET,
  MAX_BYTES,
  MIME_TYPES,
  subirRecibo,
  crearUrlsRecibos,
  eliminarRecibo,
};
