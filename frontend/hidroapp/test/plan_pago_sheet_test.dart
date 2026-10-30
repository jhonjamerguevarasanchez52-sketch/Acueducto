import 'dart:convert';

import 'package:acueducto_app/services/api_service.dart';
import 'package:acueducto_app/theme/app_theme.dart';
import 'package:acueducto_app/widgets/facturas/plan_pago_sheet.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  testWidgets('muestra los tres planes y el total Wompi estimado', (tester) async {
    final api = ApiService(
      client: MockClient((_) async => http.Response(
        jsonEncode({
          'puedeCambiarPlan': true,
          'opciones': [
            {
              'meses': 1,
              'periodoInicio': '2026-10',
              'periodoFin': '2026-10',
              'proximoPeriodo': '2026-11',
              'fechaProximaFacturacion': '2026-12-01',
              'valorServicio': 12000,
              'cargoWompi': 1251,
              'totalCobrar': 13251,
            },
            {
              'meses': 6,
              'periodoInicio': '2026-10',
              'periodoFin': '2027-03',
              'proximoPeriodo': '2027-04',
              'fechaProximaFacturacion': '2027-05-01',
              'valorServicio': 72000,
              'cargoWompi': 3205,
              'totalCobrar': 75205,
            },
            {
              'meses': 12,
              'periodoInicio': '2026-10',
              'periodoFin': '2027-09',
              'proximoPeriodo': '2027-10',
              'fechaProximaFacturacion': '2027-11-01',
              'valorServicio': 144000,
              'cargoWompi': 5550,
              'totalCobrar': 149550,
              'disponible': false,
              'motivoNoDisponible': 'El periodo 2027-06 ya tiene su propia factura.',
            },
          ],
        }),
        200,
      )),
    );
    addTearDown(api.dispose);

    Map<String, dynamic>? elegido;
    await tester.pumpWidget(MaterialApp(
      theme: AppTheme.light,
      home: Builder(
        builder: (context) => Scaffold(
          body: Center(
            child: ElevatedButton(
              onPressed: () async =>
                  elegido = await mostrarPlanPagoSheet(context, api, 'factura-1'),
              child: const Text('Abrir'),
            ),
          ),
        ),
      ),
    ));
    await tester.tap(find.text('Abrir'));
    await tester.pumpAndSettle();

    // Primero se ve la factura del mes con "Pagar" y "Más pagos".
    expect(find.text('Pagar factura'), findsOneWidget);
    expect(find.text('Mensualidad de octubre de 2026'), findsOneWidget);
    expect(find.textContaining('\$ 13.251'), findsOneWidget);
    expect(find.text('Más pagos'), findsOneWidget);
    expect(find.textContaining('Semestral · '), findsNothing);

    await tester.tap(find.text('Más pagos'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Semestral · '), findsOneWidget);
    expect(find.textContaining('Anual · '), findsOneWidget);
    expect(find.textContaining('\$ 75.205'), findsOneWidget);
    expect(find.textContaining('Próxima factura: abril de 2027'), findsOneWidget);
    expect(find.textContaining('2027-06 ya tiene su propia factura'), findsOneWidget);

    // El plan anual bloqueado explica por qué y deja pagar la mensualidad.
    await tester.ensureVisible(find.textContaining('Anual · '));
    await tester.pumpAndSettle();
    await tester.tap(find.textContaining('Anual · '));
    await tester.pumpAndSettle();
    expect(find.text('El plan anual no está disponible'), findsOneWidget);
    expect(find.textContaining('2027-06 ya tiene su propia factura'), findsNWidgets(2));
    await tester.tap(find.text('Pagar solo esta mensualidad'));
    await tester.pumpAndSettle();
    expect(elegido?['meses'], 1, reason: 'cierra la hoja eligiendo la mensual');
  });
}
