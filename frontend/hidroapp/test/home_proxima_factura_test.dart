import 'package:acueducto_app/models/factura.dart';
import 'package:acueducto_app/theme/app_theme.dart';
import 'package:acueducto_app/widgets/home/home_proxima_factura.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Future<void> mostrar(WidgetTester tester, List<Factura> facturas) => tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(
          body: ProximaFactura(
            snap: AsyncSnapshot.withData(ConnectionState.done, facturas),
            onPagar: (_) async {},
          ),
        ),
      ),
    );

Factura factura(String estado, {String? vence}) => Factura.fromJson({
      'id': '$estado-$vence',
      'periodo': '2026-10',
      'valor_total': 12000,
      'estado': estado,
      'fecha_vencimiento': vence,
    });

void main() {
  testWidgets('una factura pendiente sin fecha límite no se muestra como "al día"', (tester) async {
    await mostrar(tester, [factura('pendiente')]);
    expect(find.text('Estás al día'), findsNothing);
    expect(find.text('Sin fecha límite'), findsOneWidget);
    expect(find.textContaining('12.000'), findsOneWidget);
  });

  testWidgets('prioriza la factura con vencimiento más cercano', (tester) async {
    await mostrar(tester, [factura('pendiente'), factura('pendiente', vence: '2020-01-15')]);
    expect(find.textContaining('Venció hace'), findsOneWidget);
  });

  testWidgets('sin pendientes sí muestra "al día"', (tester) async {
    await mostrar(tester, [factura('pagada', vence: '2026-11-15')]);
    expect(find.text('Estás al día'), findsOneWidget);
  });
}
