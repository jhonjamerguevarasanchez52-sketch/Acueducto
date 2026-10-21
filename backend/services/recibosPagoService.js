const { randomUUID } = require('crypto');
const supabaseAdmin = require('../config/supabaseAdminClient');

const BUCKET = 'payment-receipts';
const MAX_BYTES = 5 * 1024 * 1024;
const MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
let bucketReady;

async function asegurarBucketPrivado() {
  if (!bucketReady) {
    bucketReady = (async () => {
      const storage = supabaseAdmin.storage;
      const opciones = {
        public: false,
        fileSizeLimit: MAX_BYTES,
        allowedMimeTypes: MIME_TYPES,
      };
      const { data: existente, error: errorConsulta } = await storage.getBucket(BUCKET);

      if (existente) {
        const { error } = await storage.updateBucket(BUCKET, opciones);
        if (error) throw error;
        return;
      }

      if (errorConsulta && errorConsulta.statusCode !== '404') throw errorConsulta;
      const { error } = await storage.createBucket(BUCKET, opciones);
      if (error) {
        if (!/already exists|duplicate/i.test(error.message || '')) throw error;
        const { data: carrera, error: errorCarrera } = await storage.getBucket(BUCKET);
        if (!carrera || errorCarrera) throw errorCarrera || error;
        const { error: errorActualizacion } = await storage.updateBucket(BUCKET, opciones);
        if (errorActualizacion) throw errorActualizacion;
      }
    })().catch((error) => {
      bucketReady = null;
      throw error;
    });
  }
  return bucketReady;
}

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
