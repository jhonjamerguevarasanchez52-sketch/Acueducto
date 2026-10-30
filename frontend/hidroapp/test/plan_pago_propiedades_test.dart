import 'dart:convert';
import 'dart:math';

import 'package:acueducto_app/models/factura.dart';
import 'package:acueducto_app/models/pago.dart';
import 'package:acueducto_app/services/api_service.dart';
import 'package:acueducto_app/theme/app_theme.dart';
import 'package:acueducto_app/utils/formato.dart';
import 'package:acueducto_app/widgets/facturas/plan_pago_sheet.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

/// Cálculo independiente de meses (aritmética entera) para comparar.
String mesesDesde(String periodo, int n) {
  final p = periodo.split('-').map(int.parse).toList();
  final total = p[0] * 12 + (p[1] - 1) + n;
  return '${total ~/ 12}-${((total % 12) + 1).toString().padLeft(2, '0')}';
}

/// Separador de miles de referencia, sin depender de Formato.
String pesosReferencia(int v) {
  final s = v.abs().toString().replaceAllMapped(
    RegExp(r'\B(?=(\d{3})+(?!\d))'),
    (_) => '.',
  );
  return '${v < 0 ? '-' : ''}\$ $s';
}

const nombresMes = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', //
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

void main() {
  group('Factura.periodosCubiertos coincide con el cálculo del backend', () {
    for (var anio = 2000; anio <= 2099; anio++) {
      test('todos los meses de $anio con planes de 1, 6 y 12', () {
        for (var mes = 1; mes <= 12; mes++) {
          final inicio = '$anio-${mes.toString().padLeft(2, '0')}';
          for (final meses in [1, 6, 12]) {
            final f = Factura.fromJson({
              'id': 'f',
              'periodo': inicio,
              'periodo_inicio': inicio,
              'meses_cubiertos': meses,
              'valor_total': 12000 * meses,
              'estado': 'pendiente',
            });
            expect(
              f.periodosCubiertos,
              List.generate(meses, (i) => mesesDesde(inicio, i)),
              reason: '$inicio x$meses',
            );
            expect(
              Formato.periodo(inicio),
              '${nombresMes[mes - 1]} de $anio',
            );
          }
        }
      });
    }
  });

  group('Formato.pesos con separador de miles correcto', () {
    for (var desde = 0; desde < 2000000; desde += 100000) {
      test('de $desde a ${desde + 99999}', () {
        for (var v = desde; v < desde + 100000; v += 7) {
          expect(Formato.pesos(v), pesosReferencia(v));
        }
      });
    }
    test('valores con decimales se redondean', () {
      expect(Formato.pesos(13250.6), '\$ 13.251');
      expect(Formato.pesos(null), '\$ 0');
    });
  });

  group('lectura tolerante de facturas y pagos malformados', () {
    final valores = <Object?>[
      null, '', '  ', 'abc', 0, -1, 6, '6', 12.0, '2026-10', '09/10/2026',
      true, <String, dynamic>{}, <dynamic>[], '2026-10-05T15:30:00Z',
    ];
    final campos = [
      'periodo', 'periodo_inicio', 'periodo_fin', 'meses_cubiertos',
      'valor_total', 'estado', 'fecha_emision', 'fecha_proxima_facturacion',
      'fecha_ultimo_pago', 'detalle_prepago', 'observacion',
    ];
    for (var semilla = 0; semilla < 300; semilla++) {
      test('JSON aleatorio $semilla no rompe la app', () {
        final r = Random(semilla);
        final json = <String, dynamic>{'id': 'f$semilla'};
        for (final c in campos) {
          if (r.nextBool()) json[c] = valores[r.nextInt(valores.length)];
        }
        if (r.nextBool()) {
          json['pagos'] = [
            {
              'id': 'p',
              'monto': valores[r.nextInt(valores.length)],
              'cargo_wompi': valores[r.nextInt(valores.length)],
              'monto_total': valores[r.nextInt(valores.length)],
              'confirmado': r.nextBool(),
              'estado_wompi': r.nextBool() ? 'APPROVED' : 'DECLINED',
            },
          ];
        }
        final f = Factura.fromJson(json);
        expect(f.mesesCubiertos, isA<int>());
        expect(f.periodosCubiertos, isNotEmpty);
        expect(f.pagosConfirmados.every((p) => p.confirmado), isTrue);
        expect(() => Formato.periodo(f.periodo), returnsNormally);
      });
    }
    test('Pago.fromJson tolera campos vacíos', () {
      final p = Pago.fromJson({'id': 'p', 'factura_id': 'f', 'monto': '12000'});
      expect(p.cargoWompi, 0);
      expect(p.transaccionId, isNull);
    });
  });

  group('hoja de planes con respuestas aleatorias del backend', () {
    for (var semilla = 0; semilla < 60; semilla++) {
      testWidgets('respuesta $semilla', (tester) async {
        final r = Random(semilla);
        final especial = r.nextInt(4) == 0;
        final meses = especial ? [1] : [1, 6, 12];
        final opciones = [
          for (final m in meses)
            {
              'meses': m,
              'periodoInicio': especial ? '09/10/2026' : '2026-10',
              'periodoFin': especial ? '09/10/2026' : mesesDesde('2026-10', m - 1),
              'proximoPeriodo': especial ? null : mesesDesde('2026-10', m),
              'fechaProximaFacturacion':
                  especial ? null : '${mesesDesde('2026-10', m + 1)}-01',
              'valorServicio': especial ? 15000 : 12000 * m,
              'cargoWompi': 1000 + m,
              'totalCobrar': (especial ? 15000 : 12000 * m) + 1000 + m,
              'disponible': m == 1 || r.nextBool(),
              'motivoNoDisponible': 'El periodo 2027-02 ya tiene su propia factura.',
            },
        ];
        final api = ApiService(
          client: MockClient(
            (_) async => http.Response(
              jsonEncode({
                'puedeCambiarPlan': !especial,
                'motivoSinPlanes': especial
                    ? 'Esta factura tiene un valor especial; se paga tal como fue emitida.'
                    : null,
                'opciones': opciones,
              }),
              200,
            ),
          ),
        );
        addTearDown(api.dispose);

        Map<String, dynamic>? elegido;
        await tester.pumpWidget(
          MaterialApp(
            theme: AppTheme.light,
            home: Builder(
              builder: (context) => Scaffold(
                body: Center(
                  child: ElevatedButton(
                    onPressed: () async =>
                        elegido = await mostrarPlanPagoSheet(context, api, 'f'),
                    child: const Text('Abrir'),
                  ),
                ),
              ),
            ),
          ),
        );
        await tester.tap(find.text('Abrir'));
        await tester.pumpAndSettle();

        expect(find.textContaining('null'), findsNothing);
        expect(find.text('Pagar factura'), findsOneWidget);
        final mensual = opciones.first;
        expect(
          find.textContaining(Formato.pesos(mensual['totalCobrar'] as num)),
          findsOneWidget,
        );
        if (especial) {
          expect(find.textContaining('valor especial'), findsOneWidget);
          expect(find.textContaining('Próxima factura'), findsNothing);
          expect(find.text('Más pagos'), findsNothing, reason: 'sin planes largos');
        } else {
          // Los planes largos aparecen solo al tocar "Más pagos".
          expect(find.textContaining('Semestral · '), findsNothing);
          await tester.tap(find.text('Más pagos'));
          await tester.pumpAndSettle();
          for (final o in opciones) {
            expect(
              find.textContaining(Formato.pesos(o['totalCobrar'] as num)),
              findsOneWidget,
            );
          }
          // Tocar un plan bloqueado no cierra la hoja.
          final bloqueada = opciones.where((o) => o['disponible'] == false);
          if (bloqueada.isNotEmpty) {
            final m = bloqueada.first['meses'] as int;
            final destino = find.textContaining('${nombrePlanPago(m)} · ');
            await tester.ensureVisible(destino);
            await tester.pumpAndSettle();
            await tester.tap(destino);
            await tester.pumpAndSettle();
            expect(elegido, isNull);
            expect(find.textContaining('no está disponible'), findsOneWidget, reason: 'explica el bloqueo');
            await tester.tap(find.text('Entendido'));
            await tester.pumpAndSettle();
          }
        }

        // Elegir: la mensual con "Pagar" o un plan largo libre.
        final libres = opciones.skip(1).where((o) => o['disponible'] == true).toList();
        if (!especial && libres.isNotEmpty && r.nextBool()) {
          final o = libres[r.nextInt(libres.length)];
          final destino = find.textContaining('${nombrePlanPago(o['meses'] as int)} · ');
          await tester.ensureVisible(destino);
          await tester.pumpAndSettle();
          await tester.tap(destino);
          await tester.pumpAndSettle();
          expect(elegido?['meses'], o['meses']);
        } else {
          await tester.ensureVisible(find.text('Pagar'));
          await tester.pumpAndSettle();
          await tester.tap(find.text('Pagar'));
          await tester.pumpAndSettle();
          expect(elegido?['meses'], 1);
        }
      });
    }
  });
}
