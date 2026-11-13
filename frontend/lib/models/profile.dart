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
    this.zona,
    this.isVerified = false,
  });

  final String id;
  final String correo;
  final String nombre;
  final String apellido;
  final String rol;
  final String? telefono;
  final String? numeroLote;
  final String? direccion;
  final String? zona;
  final bool isVerified;

  String get nombreCompleto => '$nombre $apellido'.trim();

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
      zona: json['zona']?.toString(),
      isVerified: json['is_verified'] == true,
    );
  }
}
