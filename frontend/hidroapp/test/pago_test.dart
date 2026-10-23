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
}
