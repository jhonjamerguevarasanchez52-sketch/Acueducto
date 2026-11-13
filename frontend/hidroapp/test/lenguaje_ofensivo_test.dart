import 'package:acueducto_app/services/api_service.dart';
import 'package:acueducto_app/theme/app_theme.dart';
import 'package:acueducto_app/utils/lenguaje_ofensivo.dart';
import 'package:acueducto_app/widgets/core/pagar_sheet.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  test('detecta groserías y racismo aunque los disfracen', () {
    for (final texto in [
      'eres un hijueputa', 'HIJO DE PERRA', 'gonorrea', 'estúpido', 'P.U.T.A',
      'puuuuta', 'm1erd@', 'p u t a', 'hpta', 'negro de mierda', 'veneco',
      'fuck you',
      // Con signos al final (antes se escapaban: "!" se leía como "i").
      'qué puta!!', 'oiga ZORRA!', 'idiota!!!', 'h!jo de puta!',
    ]) {
      expect(contieneLenguajeOfensivo(texto), isTrue, reason: texto);
    }
  });

  test('no bloquea textos normales del acueducto', () {
    for (final texto in [
      'Tengo una fuga en la calle 15 # 3-40', 'la computadora', 'hay una disputa',
      'la motobomba de 2 hp no arranca', 'el agua ha arrastrado tierra',
      'mi perro tomó agua', 'el tubo negro está roto', 'el señor Peña',
      'calle 3 a 4', 'Hola GOTA',
    ]) {
      expect(contieneLenguajeOfensivo(texto), isFalse, reason: texto);
    }
  });

  test('ApiService no envía al servidor textos ofensivos', () async {
    var llamadas = 0;
    final api = ApiService(
      client: MockClient((_) async {
        llamadas++;
        return http.Response('{}', 200);
      }),
    );
    addTearDown(api.dispose);

    await expectLater(
      api.post('/averias', body: {'descripcion': 'fuga, malparidos'}),
      throwsA(isA<ApiException>().having(
        (e) => e.message, 'message', mensajeLenguajeOfensivo,
      )),
    );
    expect(llamadas, 0);

    // Las contraseñas no se revisan.
    await api.post('/auth/login', body: {'password': 'Puta1234'});
    expect(llamadas, 1);
  });

  testWidgets('el diálogo de pago queda centrado y su botón fuera de la barra '
      'de botones de Android', (tester) async {
    tester.view.physicalSize = const Size(1080, 2000);
    tester.view.devicePixelRatio = 3;
    // Barra de 3 botones de 48 dp abajo.
    tester.view.padding = const FakeViewPadding(bottom: 144, top: 72);
    tester.view.viewPadding = const FakeViewPadding(bottom: 144, top: 72);
    addTearDown(tester.view.reset);

    await tester.pumpWidget(MaterialApp(
      theme: AppTheme.light,
      home: Builder(
        builder: (context) => Scaffold(
          body: Center(
            child: ElevatedButton(
              onPressed: () => mostrarPagarSheet(context, subtitulo: 'Octubre'),
              child: const Text('Abrir'),
            ),
          ),
        ),
      ),
    ));
    await tester.tap(find.text('Abrir'));
    await tester.pumpAndSettle();

    expect(find.byType(Dialog), findsOneWidget);
    expect(find.byType(BottomSheet), findsNothing);
    final boton = tester.getRect(find.text('Continuar con Wompi'));
    final alto = 2000 / 3;
    expect(boton.bottom, lessThan(alto - 48), reason: 'no queda bajo la barra');
  });
}
