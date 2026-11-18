import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:acueducto_app/screens/welcome_screen.dart';
import 'package:acueducto_app/theme/app_theme.dart';

void main() {
  testWidgets('La página de presentación se muestra', (WidgetTester tester) async {
    await tester.pumpWidget(
      MaterialApp(theme: AppTheme.light, home: const WelcomeScreen()),
    );

    expect(find.text('Acueducto Campo Amor'), findsOneWidget);
    expect(find.text('Iniciar sesión'), findsOneWidget);
    expect(find.text('Crear cuenta'), findsNothing);
  });
}
