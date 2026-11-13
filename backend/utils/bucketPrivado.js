const supabaseAdmin = require('../config/supabaseAdminClient');

// Devuelve una función que crea (o ajusta) un bucket privado de Storage la
// primera vez que se llama y reutiliza esa misma promesa después. Si falla,
// se olvida la promesa para reintentar en la siguiente petición.
function crearBucketPrivado(bucket, { fileSizeLimit, allowedMimeTypes }) {
  let listo;
  const opciones = { public: false, fileSizeLimit, allowedMimeTypes };

  return function asegurarBucketPrivado() {
    if (!listo) {
      listo = (async () => {
        const storage = supabaseAdmin.storage;
        const { data: existente, error: errorConsulta } = await storage.getBucket(bucket);

        if (existente) {
          const { error } = await storage.updateBucket(bucket, opciones);
          if (error) throw error;
          return;
        }

        if (errorConsulta && errorConsulta.statusCode !== '404') throw errorConsulta;
        const { error } = await storage.createBucket(bucket, opciones);
        if (error) {
          if (!/already exists|duplicate/i.test(error.message || '')) throw error;
          const { data: carrera, error: errorCarrera } = await storage.getBucket(bucket);
          if (!carrera || errorCarrera) throw errorCarrera || error;
          const { error: errorActualizacion } = await storage.updateBucket(bucket, opciones);
          if (errorActualizacion) throw errorActualizacion;
        }
      })().catch((error) => {
        listo = null;
        throw error;
      });
    }
    return listo;
  };
}

module.exports = { crearBucketPrivado };
