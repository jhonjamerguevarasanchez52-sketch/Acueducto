import 'package:acueducto_app/models/pago.dart';
import 'package:flutter_test/flutter_test.dart';

Pago pagoConEstado(String estado) => Pago.fromJson({
  'id': 'pago-1',
  'factura_id': 'factura-1',
  'monto': 12000,
  'metodo': 'wompi',
  'confirmado': false,
  'estado_wompi': estado,
});

void main() {
  test('un rechazo terminal permite reintentar el pago', () {
    final pago = pagoConEstado('DECLINED');

    expect(pago.rechazado, isTrue);
    expect(pago.requiereRevision, isFalse);
    expect(pago.reemplazado, isFalse);
  });

  test('un monto inválido requiere revisión para evitar un doble cobro', () {
    final pago = pagoConEstado('MONTO_INVALIDO');

    expect(pago.rechazado, isFalse);
    expect(pago.requiereRevision, isTrue);
  });

  test('los intentos sustituidos no aparecen como pendientes cobrables', () {
    final pago = pagoConEstado('SUPERSEDED');

    expect(pago.reemplazado, isTrue);
    expect(pago.rechazado, isFalse);
  });

  test('conserva el cargo Wompi y los identificadores de transacción', () {
    final pago = Pago.fromJson({
      'id': 'pago-2',
      'factura_id': 'factura-plan',
      'monto': 72000,
      'cargo_wompi': 3205,
      'monto_total': 75205,
      'metodo': 'wompi',
      'confirmado': true,
      'transaccion_id': 'trx-123',
      'medio_pago_wompi': 'PSE',
    });

    expect(pago.cargoWompi, 3205);
    expect(pago.montoTotal, 75205);
    expect(pago.transaccionId, 'trx-123');
    expect(pago.medioPagoWompi, 'PSE');
  });
}
