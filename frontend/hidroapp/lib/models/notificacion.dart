import '../utils/formato.dart';

/// Aviso para el usuario, tal como lo devuelve `GET /api/notificaciones`.
class Notificacion {
  Notificacion({
    required this.id,
    required this.mensaje,
    required this.tipo,
    required this.leida,
    this.fecha,
  });

  final String id;
  final String mensaje;
  final String tipo; // general | factura | pago | averia | corte ...
  final bool leida;
  final DateTime? fecha;

  Notificacion copyWith({bool? leida}) => Notificacion(
        id: id,
        mensaje: mensaje,
        tipo: tipo,
        leida: leida ?? this.leida,
        fecha: fecha,
      );

  factory Notificacion.fromJson(Map<String, dynamic> json) {
    return Notificacion(
      id: json['id']?.toString() ?? '',
      mensaje: json['mensaje']?.toString() ?? '',
      tipo: json['tipo']?.toString() ?? 'general',
      leida: json['estado']?.toString() == 'leido',
      fecha: parsearFecha(json['fecha']),
    );
  }

  /// La respuesta de `misNotificaciones` es un array plano.
  static List<Notificacion> listaDesde(dynamic data) {
    if (data is! List) return const [];
    return data
        .whereType<Map>()
        .map((e) => Notificacion.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }
}
