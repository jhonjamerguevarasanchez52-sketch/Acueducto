import '../utils/formato.dart';

/// Avería reportada por el usuario, tal como la devuelve
/// `GET /api/averias/mis-averias` (bajo la clave `data`).
class Averia {
  Averia({
    required this.id,
    required this.descripcion,
    required this.estado,
    this.zona,
    this.notaFontanero,
    this.fechaReporte,
    this.fechaResolucion,
  });

  final String id;
  final String descripcion;
  final String estado; // reportada | en_proceso | resuelta | cancelada
  final String? zona;
  final String? notaFontanero;
  final DateTime? fechaReporte;
  final DateTime? fechaResolucion;

  bool get cerrada => estado == 'resuelta' || estado == 'cancelada';

  factory Averia.fromJson(Map<String, dynamic> json) {
    return Averia(
      id: json['id']?.toString() ?? '',
      descripcion: json['descripcion']?.toString() ?? '',
      estado: json['estado']?.toString() ?? 'reportada',
      zona: (json['zona']?.toString().trim().isEmpty ?? true)
          ? null
          : json['zona'].toString(),
      notaFontanero:
          (json['nota_fontanero']?.toString().trim().isEmpty ?? true)
              ? null
              : json['nota_fontanero'].toString(),
      fechaReporte: parsearFecha(json['fecha_reporte']),
      fechaResolucion: parsearFecha(json['fecha_resolucion']),
    );
  }

  /// Tanto `misAverias` como `reportarAveria` envuelven la respuesta en
  /// `{ data: ... }`; esto acepta la lista o un único objeto.
  static List<Averia> listaDesde(dynamic respuesta) {
    final data = respuesta is Map ? respuesta['data'] : respuesta;
    if (data is! List) return const [];
    return data
        .whereType<Map>()
        .map((e) => Averia.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  static Averia? unaDesde(dynamic respuesta) {
    final data = respuesta is Map ? respuesta['data'] : respuesta;
    if (data is Map) {
      return Averia.fromJson(Map<String, dynamic>.from(data));
    }
    return null;
  }
}
