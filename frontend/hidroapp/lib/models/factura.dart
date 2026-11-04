import '../utils/formato.dart';
import 'pago.dart';

/// Factura emitida al usuario, tal como la devuelve `GET /api/facturas`.
class Factura {
  Factura({
    required this.id,
    required this.periodo,
    required this.valorTotal,
    required this.estado,
    this.fechaEmision,
    this.fechaVencimiento,
    this.periodoInicio,
    this.periodoFin,
    this.mesesCubiertos = 1,
    this.detallePrepago,
    this.pagos = const [],
    this.fechaUltimoPago,
    this.fechaProximaFacturacion,
    this.observacion,
  });

  final String id;
  final String periodo;
  final double valorTotal;
  final String estado; // pendiente | pagada | anulada | vencida
  final DateTime? fechaEmision;
  final DateTime? fechaVencimiento;
  final String? periodoInicio;
  final String? periodoFin;
  final int mesesCubiertos;
  final String? detallePrepago;
  final List<Pago> pagos;
  final DateTime? fechaUltimoPago;
  final DateTime? fechaProximaFacturacion;
  final String? observacion;

  bool get estaPendiente => estado == 'pendiente' || estado == 'vencida';

  /// Meses (`AAAA-MM`) que paga esta factura: uno en la mensual, seis en la
  /// semestral y doce en la anual.
  List<String> get periodosCubiertos {
    final inicio = RegExp(
      r'^(\d{4})-(\d{2})$',
    ).firstMatch(periodoInicio ?? periodo);
    if (inicio == null) return [periodo];
    final anio = int.parse(inicio.group(1)!);
    final mes = int.parse(inicio.group(2)!);
    return List.generate(mesesCubiertos < 1 ? 1 : mesesCubiertos, (i) {
      final fecha = DateTime(anio, mes + i);
      return '${fecha.year}-${fecha.month.toString().padLeft(2, '0')}';
    });
  }

  /// Pagos confirmados de la factura (excluye intentos rechazados o pendientes).
  List<Pago> get pagosConfirmados =>
      pagos.where((pago) => pago.confirmado).toList();

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
      periodoInicio: json['periodo_inicio']?.toString(),
      periodoFin: json['periodo_fin']?.toString(),
      mesesCubiertos:
          int.tryParse(json['meses_cubiertos']?.toString() ?? '') ?? 1,
      detallePrepago:
          (json['detalle_prepago']?.toString().trim().isEmpty ?? true)
          ? null
          : json['detalle_prepago'].toString(),
      pagos: Pago.listaDesde(json['pagos']),
      fechaUltimoPago: parsearFecha(json['fecha_ultimo_pago']),
      fechaProximaFacturacion: parsearFecha(json['fecha_proxima_facturacion']),
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
