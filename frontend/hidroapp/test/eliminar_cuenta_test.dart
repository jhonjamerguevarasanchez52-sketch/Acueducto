import 'dart:convert';

import 'package:acueducto_app/main.dart';
import 'package:acueducto_app/providers/auth_provider.dart';
import 'package:acueducto_app/providers/theme_provider.dart';
import 'package:acueducto_app/services/api_service.dart';
import 'package:acueducto_app/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:provider/provider.dart';

Future<void> _asentar(WidgetTester tester) async {
  for (var i = 0; i < 8; i++) {
    await tester.pump(const Duration(milliseconds: 250));
  }
}

class _Storage implements AuthSessionStorage {
  final values = <String, String>{'access_token': 'token'};

  @override
  Future<String?> read(String key) async => values[key];

  @override
  Future<void> write(String key, String value) async => values[key] = value;

  @override
  Future<void> delete(String key) async => values.remove(key);
}

void main() {
  testWidgets('eliminar cuenta cierra la sesión y muestra el login', (
    tester,
  ) async {
    var cuentaEliminada = false;
    final api = ApiService(
      client: MockClient((request) async {
        if (request.method == 'DELETE' &&
            request.url.path.endsWith('/profile/mi-cuenta')) {
          cuentaEliminada = true;
          return http.Response('{}', 200);
        }
        if (request.url.path.endsWith('/profile/mi-perfil')) {
          return http.Response(
            jsonEncode({
              'id': 'u1',
              'nombre': 'Ana',
              'apellido': 'Torres',
              'correo': 'ana@example.com',
              'rol': 'usuario',
              'activo': true,
              'is_verified': true,
              'debe_cambiar_password': false,
            }),
            200,
          );
        }
        return http.Response('[]', 200);
      }),
    );
    final auth = AuthProvider(api: api, storage: _Storage());
    addTearDown(auth.dispose);
    await auth.bootstrap();

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider.value(value: auth),
          ChangeNotifierProvider(create: (_) => ThemeProvider()),
        ],
        child: MaterialApp(theme: AppTheme.light, home: const AuthGate()),
      ),
    );
    await _asentar(tester);
    await tester.tap(find.text('Perfil'));
    await _asentar(tester);
    expect(find.text('Mi perfil'), findsOneWidget);
    for (
      var i = 0;
      i < 4 && find.text('Eliminar cuenta').evaluate().isEmpty;
      i++
    ) {
      await tester.drag(find.byType(ListView).first, const Offset(0, -500));
      await _asentar(tester);
    }
    await _asentar(tester);
    await tester.tap(find.text('Eliminar cuenta'));
    await _asentar(tester);
    await tester.enterText(find.byType(TextField).first, 'clave');
    await tester.tap(find.text('Eliminar definitivamente'));
    await _asentar(tester);

    expect(cuentaEliminada, isTrue);
    expect(auth.status, AuthStatus.unauthenticated);
    expect(find.text('HIDROAPP'), findsOneWidget);
  });
}
