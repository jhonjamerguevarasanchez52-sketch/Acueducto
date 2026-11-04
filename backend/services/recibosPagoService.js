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

async function crearUrlRecibo(path) {
  if (!path) return null;
  await asegurarBucketPrivado();
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(path, 10 * 60);
  if (error) throw error;
  return data.signedUrl;
}

async function eliminarRecibo(path) {
  if (!path) return;
  const { error } = await supabaseAdmin.storage.from(BUCKET).remove([path]);
  if (error) console.error('[pagos] no se pudo limpiar un recibo sin pago asociado:', error.message);
}

module.exports = { BUCKET, MAX_BYTES, MIME_TYPES, subirRecibo, crearUrlRecibo, eliminarRecibo };
