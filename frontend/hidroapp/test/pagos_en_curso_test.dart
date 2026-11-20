import 'package:acueducto_app/models/factura.dart';
import 'package:acueducto_app/models/pago.dart';
import 'package:flutter_test/flutter_test.dart';

final _ahora = DateTime(2026, 11, 13, 12);

Pago _pago(
  String id, {
  String factura = 'f1',
  String metodo = 'wompi',
  bool confirmado = false,
  String? estado,
  String? transaccion,
  Duration hace = const Duration(hours: 2),
}) => Pago(
  id: id,
  facturaId: factura,
  monto: 12000,
  metodo: metodo,
  confirmado: confirmado,
  estadoWompi: estado,
  transaccionId: transaccion,
  fechaPago: _ahora.subtract(hace),
);

void main() {
  group('Pago.enCurso', () {
    test('un recibo físico por revisar bloquea otro pago', () {
      expect(_pago('p', metodo: 'fisico').enCurso(_ahora), isTrue);
    });

    test('un checkout reciente de Wompi está en curso', () {
      final pago = _pago(
        'p',
        estado: 'PENDING',
        hace: const Duration(minutes: 5),
      );
      expect(pago.enCurso(_ahora), isTrue);
    });

    test('un checkout abandonado (más de 30 min) ya no bloquea', () {
      expect(_pago('p', estado: 'PENDING').enCurso(_ahora), isFalse);
    });

    test('un cobro por devolver sigue bloqueando', () {
      expect(
        _pago('p', estado: 'APPROVED_NO_APLICADO').enCurso(_ahora),
        isTrue,
      );
    });

    test('rechazados, reemplazados y confirmados no bloquean', () {
      expect(_pago('a', estado: 'DECLINED').enCurso(_ahora), isFalse);
      expect(_pago('b', estado: 'SUPERSEDED').enCurso(_ahora), isFalse);
      expect(_pago('c', confirmado: true).enCurso(_ahora), isFalse);
    });
  });

  group('Pago.reintentables', () {
    test('solo el intento más reciente de cada factura', () {
      final pagos = [
        _pago('viejo', estado: 'DECLINED', hace: const Duration(days: 2)),
        _pago('nuevo', estado: 'DECLINED', hace: const Duration(days: 1)),
      ];
      expect(Pago.reintentables(pagos, _ahora), {'nuevo'});
    });

    test('nada si la factura ya quedó pagada con otro intento', () {
      final pagos = [
        _pago('rechazado', estado: 'DECLINED'),
        _pago('bueno', confirmado: true, estado: 'APPROVED'),
      ];
      expect(Pago.reintentables(pagos, _ahora), isEmpty);
    });

    test('nada si hay un recibo físico en revisión', () {
      final pagos = [
        _pago('rechazado', estado: 'DECLINED'),
        _pago('recibo', metodo: 'fisico'),
      ];
      expect(Pago.reintentables(pagos, _ahora), isEmpty);
    });

    test('cada factura se evalúa por separado', () {
      final pagos = [
        _pago('a', factura: 'f1', estado: 'DECLINED'),
        _pago('b', factura: 'f2', estado: 'DECLINED'),
        _pago('c', factura: 'f2', confirmado: true),
      ];
      expect(Pago.reintentables(pagos, _ahora), {'a'});
    });
  });

  test('Factura.tienePagoEnCurso solo aplica a facturas pendientes', () {
    Factura factura(String estado, List<Pago> pagos) => Factura(
      id: 'f1',
      periodo: '2026-10',
      valorTotal: 12000,
      estado: estado,
      pagos: pagos,
    );
    final recibo = _pago('r', metodo: 'fisico');

    expect(factura('pendiente', [recibo]).tienePagoEnCurso, isTrue);
    expect(factura('pendiente', const []).tienePagoEnCurso, isFalse);
    expect(factura('pagada', [recibo]).tienePagoEnCurso, isFalse);
  });
}
