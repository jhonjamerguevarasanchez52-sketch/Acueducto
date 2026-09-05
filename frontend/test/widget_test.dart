import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:acueducto_app/screens/welcome_screen.dart';

void main() {
  testWidgets('El splash se monta y navega a la siguiente pantalla',
      (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: WelcomeScreen(
          nextRoute: Scaffold(body: Center(child: Text('DESTINO'))),
        ),
      ),
    );

    expect(find.byType(WelcomeScreen), findsOneWidget);

    // Ensamble (3800 ms) + espera (900 ms) + fade (500 ms), con margen.
    for (var i = 0; i < 70; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }

    expect(find.text('DESTINO'), findsOneWidget);
    expect(find.byType(WelcomeScreen), findsNothing);
  });
}
