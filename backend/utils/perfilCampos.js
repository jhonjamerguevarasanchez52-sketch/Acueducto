// Campos editables de "profiles" por su propio dueño o por un administrador.
const CAMPOS_EDITABLES_PERFIL = [
  'nombre', 'apellido', 'telefono', 'numero_lote',
  'direccion', 'ocupacion', 'zona',
];

// Columnas seguras de "profiles": excluye los códigos de un solo uso de
// verificación/recuperación de contraseña, que nunca deben salir de authController.
const COLUMNAS_PERFIL_PUBLICO =
  'id, nombre, apellido, correo, rol, activo, is_verified, debe_cambiar_password, ' +
  'telefono, numero_lote, direccion, ocupacion, zona, created_at, updated_at';

// Datos de la ubicación del servicio: identifican a quién se le factura y a
// dónde va el fontanero. El propio usuario solo puede llenarlos si están
// vacíos; después solo los cambia el administrador
// (ver profileController.editarPerfil).
const CAMPOS_UBICACION_SERVICIO = ['numero_lote', 'direccion', 'zona'];

const MAX_LARGO_CAMPO_PERFIL = 150;
const CAMPOS_OBLIGATORIOS_PERFIL = ['nombre', 'apellido'];

// Toma del cuerpo solo los campos editables, recortados. Devuelve
// { cambios } o { error } si algún campo no es texto, es demasiado largo o
// deja vacío el nombre/apellido.
function extraerCambiosPerfil(cuerpo = {}) {
  const cambios = {};
  for (const campo of CAMPOS_EDITABLES_PERFIL) {
    const valor = cuerpo[campo];
    if (valor === undefined) continue;
    if (valor === null && !CAMPOS_OBLIGATORIOS_PERFIL.includes(campo)) { cambios[campo] = null; continue; }
    if (typeof valor !== 'string' && typeof valor !== 'number') {
      return { error: `El campo ${campo} debe ser texto.` };
    }
    const texto = String(valor).trim();
    if (texto.length > MAX_LARGO_CAMPO_PERFIL) {
      return { error: `El campo ${campo} admite máximo ${MAX_LARGO_CAMPO_PERFIL} caracteres.` };
    }
    if (!texto && CAMPOS_OBLIGATORIOS_PERFIL.includes(campo)) {
      return { error: `El campo ${campo} no puede quedar vacío.` };
    }
    cambios[campo] = texto || null;
  }
  return { cambios };
}

module.exports = {
  extraerCambiosPerfil,
  CAMPOS_EDITABLES_PERFIL,
  COLUMNAS_PERFIL_PUBLICO,
  CAMPOS_UBICACION_SERVICIO,
};
