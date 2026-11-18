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

/// Corte anunciado por el administrador para una zona o para todo el
/// acueducto (mantenimiento, daño general). `zona` nula = todos.
class CorteProgramado {
  CorteProgramado({
    required this.id,
    required this.motivo,
    required this.inicio,
    required this.fin,
    this.zona,
  });

  final String id;
  final String motivo;
  final DateTime inicio;
  final DateTime fin;
  final String? zona;

  /// `true` si el corte ya empezó y todavía no termina.
  bool enCurso([DateTime? ahora]) {
    final momento = ahora ?? DateTime.now();
    return !momento.isBefore(inicio) && momento.isBefore(fin);
  }

  static CorteProgramado? desdeJson(Map<String, dynamic> json) {
    final inicio = parsearFecha(json['inicio']);
    final fin = parsearFecha(json['fin']);
    if (inicio == null || fin == null) return null;
    final zona = json['zona']?.toString().trim();
    return CorteProgramado(
      id: json['id']?.toString() ?? '',
      motivo: json['motivo']?.toString() ?? '',
      inicio: inicio,
      fin: fin,
      zona: (zona == null || zona.isEmpty) ? null : zona,
    );
  }

  static List<CorteProgramado> listaDesde(dynamic data) {
    if (data is! List) return const [];
    return data
        .whereType<Map>()
        .map((e) => CorteProgramado.desdeJson(Map<String, dynamic>.from(e)))
        .whereType<CorteProgramado>()
        .toList();
  }
}

/// Respuesta de `GET /api/cortes/estado`: dice si el servicio del usuario
/// está suspendido ahora mismo, el corte activo y los cortes programados
/// que vienen para su zona.
class EstadoServicio {
  EstadoServicio({
    required this.servicioCortado,
    this.corte,
    this.cortesProgramados = const [],
  });

  final bool servicioCortado;
  final Corte? corte;
  final List<CorteProgramado> cortesProgramados;

  factory EstadoServicio.fromJson(Map<String, dynamic> json) {
    final corteJson = json['corte'];
    return EstadoServicio(
      servicioCortado: json['servicioCortado'] == true,
      corte: corteJson is Map
          ? Corte.fromJson(Map<String, dynamic>.from(corteJson))
          : null,
      cortesProgramados: CorteProgramado.listaDesde(json['cortesProgramados']),
    );
  }
}
