import '../utils/formato.dart';

/// Corte del servicio de agua, tal como lo devuelve
/// `GET /api/cortes/mis-cortes` y, anidado, `GET /api/cortes/estado`.
class Corte {
  Corte({
    required this.id,
    required this.motivo,
    required this.estado,
    this.fechaCorte,
    this.fechaReconexion,
  });

  final String id;
  final String motivo;
  final String estado; // activo | resuelto
  final DateTime? fechaCorte;
  final DateTime? fechaReconexion;

  bool get activo => estado == 'activo';

  factory Corte.fromJson(Map<String, dynamic> json) {
    return Corte(
      id: json['id']?.toString() ?? '',
      motivo: json['motivo']?.toString() ?? '',
      estado: json['estado']?.toString() ?? 'activo',
      fechaCorte: parsearFecha(json['fecha_corte']),
      fechaReconexion: parsearFecha(json['fecha_reconexion']),
    );
  }

  static List<Corte> listaDesde(dynamic data) {
    if (data is! List) return const [];
    return data
        .whereType<Map>()
        .map((e) => Corte.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }
}

/// Respuesta de `GET /api/cortes/estado`: dice si el servicio del usuario
/// está suspendido ahora mismo y, si lo está, el corte activo.
class EstadoServicio {
  EstadoServicio({required this.servicioCortado, this.corte});

  final bool servicioCortado;
  final Corte? corte;

  factory EstadoServicio.fromJson(Map<String, dynamic> json) {
    final corteJson = json['corte'];
    return EstadoServicio(
      servicioCortado: json['servicioCortado'] == true,
      corte: corteJson is Map
          ? Corte.fromJson(Map<String, dynamic>.from(corteJson))
          : null,
    );
  }
}
