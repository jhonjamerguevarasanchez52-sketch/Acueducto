import 'dart:convert';

import 'package:acueducto_app/models/pago.dart';
import 'package:acueducto_app/screens/admin/admin_api.dart';
import 'package:acueducto_app/services/api_service.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

Pago _pago(Map<String, dynamic> extra) => Pago.fromJson({
      'id': 'p1',
      'factura_id': 'f1',
      'monto': 12000,
      'metodo': 'wompi',
      'confirmado': false,
      'estado_wompi': 'PENDING',
      'fecha_pago': '2026-11-09T11:00:00Z',
      ...extra,
    });

void main() {
  group('checkout de Wompi abandonado', () {
    final ahora = DateTime.parse('2026-11-09T12:00:00Z');

    test('pasados 30 minutos sin transacción se puede volver a pagar', () {
      expect(_pago({}).abandonado(ahora), isTrue);
    });

    test('si todavía está reciente o tiene transacción, sigue en curso', () {
      expect(_pago({'fecha_pago': '2026-11-09T11:50:00Z'}).abandonado(ahora), isFalse);
      expect(_pago({'transaccion_id': 'trx-1'}).abandonado(ahora), isFalse);
      expect(_pago({'metodo': 'fisico', 'estado_wompi': null}).abandonado(ahora), isFalse);
    });

    test('un cobro devuelto se reconoce como tal', () {
      expect(_pago({'estado_wompi': 'REEMBOLSADO'}).reembolsado, isTrue);
    });
  });

  test('el administrador solo ve para confirmar los recibos físicos', () async {
    final api = ApiService(
      client: MockClient(
        (_) async => http.Response(
          jsonEncode([
            {'id': 'a', 'metodo': 'fisico', 'confirmado': false, 'estado_wompi': null},
            {'id': 'b', 'metodo': 'wompi', 'confirmado': false, 'estado_wompi': 'PENDING'},
            {'id': 'c', 'metodo': 'wompi', 'confirmado': false, 'estado_wompi': 'DECLINED'},
            {'id': 'd', 'metodo': 'fisico', 'confirmado': false, 'estado_wompi': 'SUPERSEDED'},
          ]),
          200,
          headers: {'content-type': 'application/json'},
        ),
      ),
    );
    addTearDown(api.dispose);

    final pagos = await AdminApi(api).pagosSinConfirmar();
    expect(pagos.map((p) => p['id']), ['a']);
  });
}
