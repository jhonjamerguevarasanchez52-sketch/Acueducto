import '../utils/formato.dart';

/// Pago registrado contra una factura, tal como lo devuelve `GET /api/pagos`.
class Pago {
  Pago({
    required this.id,
    required this.facturaId,
    required this.monto,
    required this.metodo,
    required this.confirmado,
    this.referencia,
    this.fechaPago,
    this.fechaConfirmacion,
    this.estadoWompi,
    this.reciboUrl,
    this.cargoWompi = 0,
    this.montoTotal,
    this.transaccionId,
    this.medioPagoWompi,
  });

  final String id;
  final String facturaId;
  final double monto;
  final String metodo; // efectivo | nequi | pse | tarjeta | wompi ...
  final bool confirmado;
  final String? referencia;
  final DateTime? fechaPago;
  final DateTime? fechaConfirmacion;
  final String? estadoWompi; // APPROVED | DECLINED | VOIDED | ERROR
  final String? reciboUrl;
  final double cargoWompi;
  final double? montoTotal;
  final String? transaccionId;
  final String? medioPagoWompi;

  /// `true` si el pago llegó por Wompi y fue rechazado/anulado.
  bool get rechazado =>
      const {'DECLINED', 'VOIDED', 'ERROR'}.contains(estadoWompi) &&
      !confirmado;

  /// Requiere conciliaciÃ³n; otro intento podrÃ­a cobrar dos veces.
  bool get requiereRevision =>
      !confirmado &&
      const {'APPROVED_NO_APLICADO', 'MONTO_INVALIDO'}.contains(estadoWompi);

  bool get reemplazado => !confirmado && estadoWompi == 'SUPERSEDED';

  factory Pago.fromJson(Map<String, dynamic> json) {
    return Pago(
      id: json['id']?.toString() ?? '',
      facturaId: json['factura_id']?.toString() ?? '',
      monto: double.tryParse(json['monto']?.toString() ?? '') ?? 0,
      metodo: json['metodo']?.toString() ?? '',
      confirmado: json['confirmado'] == true,
      referencia: (json['referencia']?.toString().trim().isEmpty ?? true)
          ? null
          : json['referencia'].toString(),
      fechaPago: parsearFecha(json['fecha_pago']),
      fechaConfirmacion: parsearFecha(json['fecha_confirmacion']),
      estadoWompi: (json['estado_wompi']?.toString().trim().isEmpty ?? true)
          ? null
          : json['estado_wompi'].toString(),
      reciboUrl: (json['recibo_url']?.toString().trim().isEmpty ?? true)
          ? null
          : json['recibo_url'].toString(),
      cargoWompi: double.tryParse(json['cargo_wompi']?.toString() ?? '') ?? 0,
      montoTotal: double.tryParse(json['monto_total']?.toString() ?? ''),
      transaccionId: (json['transaccion_id']?.toString().trim().isEmpty ?? true)
          ? null
          : json['transaccion_id'].toString(),
      medioPagoWompi:
          (json['medio_pago_wompi']?.toString().trim().isEmpty ?? true)
          ? null
          : json['medio_pago_wompi'].toString(),
    );
  }

  /// La respuesta de `misPagos` es un array plano de pagos.
  static List<Pago> listaDesde(dynamic data) {
    if (data is! List) return const [];
    return data
        .whereType<Map>()
        .map((e) => Pago.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }
}
