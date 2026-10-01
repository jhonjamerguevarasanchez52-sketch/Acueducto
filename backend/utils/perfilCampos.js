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

// Días que debe esperar el usuario entre una edición de su perfil y la
// siguiente (ver profileController.editarPerfil).
const DIAS_LIMITE_EDICION_PERFIL = 30;

// Correos exentos del límite mensual de edición de perfil (comparación en
// minúsculas). Excepción puntual pedida por el propio dueño de la cuenta.
const CORREOS_SIN_LIMITE_EDICION = ['tovardeimer71@gmail.com'];

// El plazo comienza cuando la cuenta ya tiene los datos de contacto y
// ubicación necesarios para identificar el servicio.
const CAMPOS_REQUERIDOS_PERFIL_COMPLETO = ['telefono', 'numero_lote', 'direccion', 'zona'];

module.exports = {
  CAMPOS_EDITABLES_PERFIL,
  COLUMNAS_PERFIL_PUBLICO,
  DIAS_LIMITE_EDICION_PERFIL,
  CORREOS_SIN_LIMITE_EDICION,
  CAMPOS_REQUERIDOS_PERFIL_COMPLETO,
};
