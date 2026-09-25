/// Días que el backend exige entre una edición de perfil y la siguiente
/// (ver `DIAS_LIMITE_EDICION_PERFIL` en el backend).
const int diasLimiteEdicionPerfil = 30;

/// Correos exentos del límite mensual de edición (debe reflejar
/// `CORREOS_SIN_LIMITE_EDICION` en el backend). Excepción puntual pedida por
/// el propio dueño de la cuenta.
const List<String> _correosSinLimiteEdicion = ['tovardeimer71@gmail.com'];

/// Perfil del usuario tal como lo devuelve `GET /api/profile/mi-perfil`.
class Profile {
  Profile({
    required this.id,
    required this.correo,
    required this.nombre,
    required this.apellido,
    required this.rol,
    this.telefono,
    this.numeroLote,
    this.direccion,
    this.ocupacion,
    this.zona,
    this.isVerified = false,
    this.debeCambiarPassword = false,
    this.updatedAt,
  });

  final String id;
  final String correo;
  final String nombre;
  final String apellido;
  final String rol;
  final String? telefono;
  final String? numeroLote;
  final String? direccion;
  final String? ocupacion;
  final String? zona;
  final bool isVerified;

  /// `true` cuando la cuenta fue creada por un administrador con una
  /// contraseña temporal que todavía no se ha cambiado (ver
  /// AuthProvider.debeCambiarPassword).
  final bool debeCambiarPassword;

  /// Última vez que el propio usuario editó su perfil (no se sella cuando lo
  /// edita un administrador). `null` si nunca lo ha editado.
  final DateTime? updatedAt;

  String get nombreCompleto => '$nombre $apellido'.trim();

  /// Texto de ubicación a mostrar/confirmar al reportar una avería.
  String? get ubicacionCuenta {
    final partes = [direccion, zona]
        .where((p) => p != null && p.trim().isNotEmpty)
        .toList();
    return partes.isEmpty ? null : partes.join(' · ');
  }

  /// Fecha desde la que el usuario podrá volver a editar su perfil, o `null`
  /// si puede hacerlo ahora mismo.
  DateTime? get proximaEdicionDisponible {
    if (updatedAt == null) return null;
    if (_correosSinLimiteEdicion.contains(correo.toLowerCase())) return null;
    final limite = updatedAt!.add(const Duration(days: diasLimiteEdicionPerfil));
    return limite.isAfter(DateTime.now()) ? limite : null;
  }

  bool get puedeEditarPerfil => proximaEdicionDisponible == null;

  factory Profile.fromJson(Map<String, dynamic> json) {
    return Profile(
      id: json['id']?.toString() ?? '',
      correo: json['correo']?.toString() ?? '',
      nombre: json['nombre']?.toString() ?? '',
      apellido: json['apellido']?.toString() ?? '',
      rol: json['rol']?.toString() ?? 'usuario',
      telefono: json['telefono']?.toString(),
      numeroLote: json['numero_lote']?.toString(),
      direccion: json['direccion']?.toString(),
      ocupacion: json['ocupacion']?.toString(),
      zona: json['zona']?.toString(),
      isVerified: json['is_verified'] == true,
      debeCambiarPassword: json['debe_cambiar_password'] == true,
      updatedAt: DateTime.tryParse(json['updated_at']?.toString() ?? ''),
    );
  }
}
