import 'package:acueducto_app/models/factura.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('lee los periodos prepagados y fechas de pago desde la factura', () {
    final factura = Factura.fromJson({
      'id': 'factura-1',
      'periodo': '2026-10',
      'periodo_inicio': '2026-10',
      'periodo_fin': '2027-03',
      'meses_cubiertos': 6,
      'detalle_prepago': 'Incluye seis mensualidades.',
      'valor_total': 72000,
      'estado': 'pagada',
      'fecha_ultimo_pago': '2026-10-05T15:30:00.000Z',
      'fecha_proxima_facturacion': '2027-05-01',
    });

    expect(factura.mesesCubiertos, 6);
    expect(factura.periodoInicio, '2026-10');
    expect(factura.periodoFin, '2027-03');
    expect(factura.detallePrepago, 'Incluye seis mensualidades.');
    expect(factura.fechaUltimoPago, DateTime.parse('2026-10-05T15:30:00.000Z'));
    expect(factura.fechaProximaFacturacion, DateTime.parse('2027-05-01'));
  });

  test('lista cada mes pagado y solo los pagos confirmados', () {
    final factura = Factura.fromJson({
      'id': 'factura-2',
      'periodo': '2026-11',
      'periodo_inicio': '2026-11',
      'periodo_fin': '2027-10',
      'meses_cubiertos': 12,
      'valor_total': 144000,
      'estado': 'pagada',
      'pagos': [
        {'id': 'p1', 'factura_id': 'factura-2', 'monto': 144000, 'metodo': 'wompi', 'confirmado': false, 'estado_wompi': 'DECLINED'},
        {'id': 'p2', 'factura_id': 'factura-2', 'monto': 144000, 'metodo': 'wompi', 'confirmado': true, 'estado_wompi': 'APPROVED'},
      ],
    });

    expect(factura.periodosCubiertos.length, 12);
    expect(factura.periodosCubiertos.first, '2026-11');
    expect(factura.periodosCubiertos[2], '2027-01');
    expect(factura.periodosCubiertos.last, '2027-10');
    expect(factura.pagosConfirmados.map((p) => p.id), ['p2']);
  });
}
