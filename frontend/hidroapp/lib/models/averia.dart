import '../utils/formato.dart';

/// Avería reportada por el usuario, tal como la devuelve
/// `GET /api/averias/mis-averias` (bajo la clave `data`).
class Averia {
  Averia({
    required this.id,
    required this.descripcion,
    required this.estado,
    this.zona,
    this.direccion,
    this.notaFontanero,
    this.reportanteNombre,
    this.reportanteCorreo,
    this.reportanteTelefono,
    this.fechaReporte,
    this.fechaResolucion,
    this.audios = const [],
  });

  final String id;
  final String descripcion;
  final String estado; // reportada | en_proceso | resuelta | cancelada
  final String? zona;
  final String? direccion;
  final String? notaFontanero;
  final String? reportanteNombre;
  final String? reportanteCorreo;
  final String? reportanteTelefono;
  final DateTime? fechaReporte;
  final DateTime? fechaResolucion;

  /// Audios que el usuario le envió a GOTA. Solo llegan en la lista del
  /// fontanero y la administración (`GET /api/averias`).
  final List<AveriaAudio> audios;

  bool get cerrada => estado == 'resuelta' || estado == 'cancelada';

  factory Averia.fromJson(Map<String, dynamic> json) {
    final reportante = json['reportante'] is Map
        ? Map<String, dynamic>.from(json['reportante'] as Map)
        : const <String, dynamic>{};
    final nombre = '${reportante['nombre'] ?? ''} ${reportante['apellido'] ?? ''}'.trim();
    return Averia(
      id: json['id']?.toString() ?? '',
      descripcion: json['descripcion']?.toString() ?? '',
      estado: json['estado']?.toString() ?? 'reportada',
      zona: ((json['zona'] ?? reportante['zona'])?.toString().trim().isEmpty ?? true)
          ? null
          : (json['zona'] ?? reportante['zona']).toString(),
      direccion: ((json['direccion'] ?? reportante['direccion'])?.toString().trim().isEmpty ?? true)
          ? null
          : (json['direccion'] ?? reportante['direccion']).toString(),
      notaFontanero:
          (json['nota_fontanero']?.toString().trim().isEmpty ?? true)
              ? null
              : json['nota_fontanero'].toString(),
      reportanteNombre: nombre.isEmpty ? null : nombre,
      reportanteCorreo: reportante['correo']?.toString(),
      reportanteTelefono: reportante['telefono']?.toString(),
      fechaReporte: parsearFecha(json['fecha_reporte']),
      fechaResolucion: parsearFecha(json['fecha_resolucion']),
      audios: json['audios'] is List
          ? (json['audios'] as List)
              .whereType<Map>()
              .map((e) => AveriaAudio.fromJson(Map<String, dynamic>.from(e)))
              .toList()
          : const [],
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

/// Audio de una avería. El archivo es temporal (se borra 72 h después de que
/// el fontanero lo escucha); la transcripción se conserva siempre.
class AveriaAudio {
  AveriaAudio({
    required this.id,
    required this.duracionS,
    required this.transcripcion,
    required this.disponible,
    this.escuchadoEn,
    this.expiraEn,
  });

  final String id;
  final int duracionS;
  final String transcripcion;

  /// `false` cuando el archivo ya se borró y solo queda la transcripción.
  final bool disponible;
  final DateTime? escuchadoEn;
  final DateTime? expiraEn;

  factory AveriaAudio.fromJson(Map<String, dynamic> json) => AveriaAudio(
        id: json['id']?.toString() ?? '',
        duracionS: (json['duracion_s'] as num?)?.toInt() ?? 0,
        transcripcion: json['transcripcion']?.toString() ?? '',
        disponible: json['disponible'] == true,
        escuchadoEn: parsearFecha(json['escuchado_en']),
        expiraEn: parsearFecha(json['expira_en']),
      );
}
