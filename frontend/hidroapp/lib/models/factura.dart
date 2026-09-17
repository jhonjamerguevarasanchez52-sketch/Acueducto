import '../utils/formato.dart';

/// Factura emitida al usuario, tal como la devuelve `GET /api/facturas`.
class Factura {
  Factura({
    required this.id,
    required this.periodo,
    required this.valorTotal,
    required this.estado,
    this.fechaEmision,
    this.fechaVencimiento,
    this.observacion,
  });

  final String id;
  final String periodo;
  final double valorTotal;
  final String estado; // pendiente | pagada | anulada | vencida
  final DateTime? fechaEmision;
  final DateTime? fechaVencimiento;
  final String? observacion;

  bool get estaPendiente => estado == 'pendiente' || estado == 'vencida';

  /// `true` si la factura está pendiente y su fecha de vencimiento ya pasó.
  bool get estaVencida {
    if (estado == 'vencida') return true;
    if (estado != 'pendiente' || fechaVencimiento == null) return false;
    final hoy = DateTime.now();
    final v = fechaVencimiento!;
    return v.isBefore(DateTime(hoy.year, hoy.month, hoy.day));
  }

  factory Factura.fromJson(Map<String, dynamic> json) {
    return Factura(
      id: json['id']?.toString() ?? '',
      periodo: json['periodo']?.toString() ?? '',
      valorTotal: double.tryParse(json['valor_total']?.toString() ?? '') ?? 0,
      estado: json['estado']?.toString() ?? 'pendiente',
      fechaEmision: parsearFecha(json['fecha_emision']),
      fechaVencimiento: parsearFecha(json['fecha_vencimiento']),
      observacion: (json['observacion']?.toString().trim().isEmpty ?? true)
          ? null
          : json['observacion'].toString(),
    );
  }

  /// La respuesta de `misFacturas` es un array plano de facturas.
  static List<Factura> listaDesde(dynamic data) {
    if (data is! List) return const [];
    return data
        .whereType<Map>()
        .map((e) => Factura.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }
}
