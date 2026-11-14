import 'dart:convert';

import 'package:acueducto_app/providers/auth_provider.dart';
import 'package:acueducto_app/providers/theme_provider.dart';
import 'package:acueducto_app/services/api_service.dart';
import 'package:acueducto_app/theme/app_theme.dart';
import 'package:acueducto_app/widgets/auth/login_form.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:provider/provider.dart';

class _Memoria implements AuthSessionStorage {
  final Map<String, String> valores = {};
  @override
  Future<String?> read(String key) async => valores[key];
  @override
  Future<void> write(String key, String value) async => valores[key] = value;
  @override
  Future<void> delete(String key) async => valores.remove(key);
}

const _json = {'content-type': 'application/json; charset=utf-8'};

/// Monta el formulario con un backend falso y devuelve la lista de cuerpos
/// que llegaron a /auth/login.
Future<(AuthProvider, List<Map<String, dynamic>>)> _montar(
  WidgetTester tester,
) async {
  final logins = <Map<String, dynamic>>[];
  final api = ApiService(
    client: MockClient((request) async {
      if (request.url.path.endsWith('/auth/login')) {
        logins.add(jsonDecode(request.body) as Map<String, dynamic>);
        return http.Response(
          jsonEncode({
            'session': {'access_token': 'token', 'refresh_token': 'r'},
            'user': {'id': 'u1'},
          }),
          200,
          headers: _json,
        );
      }
      if (request.url.path.endsWith('/profile/mi-perfil')) {
        return http.Response(
          jsonEncode({
            'id': 'u1',
            'nombre': 'Ana',
            'apellido': 'Paz',
            'correo': 'ana@gmail.com',
            'rol': 'usuario',
          }),
          200,
          headers: _json,
        );
      }
      return http.Response('{}', 200, headers: _json);
    }),
  );
  final auth = AuthProvider(api: api, storage: _Memoria());
  await auth.bootstrap();
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: auth),
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
      ],
      child: MaterialApp(
        theme: AppTheme.light,
        home: const Scaffold(body: SingleChildScrollView(child: LoginForm())),
      ),
    ),
  );
  await tester.pump();
  return (auth, logins);
}

Future<void> _ingresar(WidgetTester tester) async {
  await tester.tap(find.text('Ingresar al sistema'));
  for (var i = 0; i < 5; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

void main() {
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));

  testWidgets('por defecto se entra con correo y se puede cambiar a cédula', (
    tester,
  ) async {
    await _montar(tester);

    expect(find.byKey(const Key('selector_metodo_ingreso')), findsOneWidget);
    expect(find.byKey(const Key('campo_correo')), findsOneWidget);
    expect(find.byKey(const Key('campo_cedula')), findsNothing);

    await tester.tap(find.text('Cédula'));
    await tester.pump();

    expect(find.byKey(const Key('campo_correo')), findsNothing);
    expect(find.byKey(const Key('campo_cedula')), findsOneWidget);
    expect(find.text('NÚMERO DE CÉDULA'), findsOneWidget);
  });

  testWidgets('con cédula envía solo los dígitos y abre la sesión', (
    tester,
  ) async {
    final (auth, logins) = await _montar(tester);

    await tester.tap(find.text('Cédula'));
    await tester.pump();
    await tester.enterText(
      find.byKey(const Key('campo_cedula')),
      '1.023.456 789',
    );
    await tester.enterText(find.byType(TextFormField).last, 'clave-segura');
    await _ingresar(tester);

    expect(logins, hasLength(1));
    expect(logins.single['cedula'], '1023456789');
    expect(logins.single.containsKey('correo'), isFalse);
    expect(logins.single['password'], 'clave-segura');
    expect(auth.status, AuthStatus.authenticated);
  });

  testWidgets('con correo sigue enviando el correo', (tester) async {
    final (_, logins) = await _montar(tester);

    await tester.enterText(
      find.byKey(const Key('campo_correo')),
      'ana@gmail.com',
    );
    await tester.enterText(find.byType(TextFormField).last, 'clave-segura');
    await _ingresar(tester);

    expect(logins.single['correo'], 'ana@gmail.com');
    expect(logins.single.containsKey('cedula'), isFalse);
  });

  testWidgets('una cédula muy corta no llega al servidor', (tester) async {
    final (_, logins) = await _montar(tester);

    await tester.tap(find.text('Cédula'));
    await tester.pump();
    await tester.enterText(find.byKey(const Key('campo_cedula')), '12');
    await tester.enterText(find.byType(TextFormField).last, 'clave-segura');
    await _ingresar(tester);

    expect(logins, isEmpty);
    expect(
      find.text('La cédula debe tener entre 5 y 15 números'),
      findsOneWidget,
    );
  });
}
