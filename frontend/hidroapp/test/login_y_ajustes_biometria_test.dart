import 'dart:convert';

import 'package:acueducto_app/providers/auth_provider.dart';
import 'package:acueducto_app/providers/theme_provider.dart';
import 'package:acueducto_app/screens/perfil_screen.dart';
import 'package:acueducto_app/services/api_service.dart';
import 'package:acueducto_app/theme/app_theme.dart';
import 'package:acueducto_app/widgets/auth/login_form.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:local_auth/local_auth.dart';
import 'package:provider/provider.dart';

class _Memoria implements AuthSessionStorage {
  _Memoria(this.valores);
  final Map<String, String> valores;
  @override
  Future<String?> read(String key) async => valores[key];
  @override
  Future<void> write(String key, String value) async => valores[key] = value;
  @override
  Future<void> delete(String key) async => valores.remove(key);
}

class _HuellaFalsa extends LocalAuthentication {
  int pedidas = 0;
  @override
  Future<bool> isDeviceSupported() async => true;
  @override
  Future<List<BiometricType>> getAvailableBiometrics() async => [BiometricType.fingerprint];
  @override
  Future<bool> authenticate({
    required String localizedReason,
    Iterable<Object?> authMessages = const [],
    AuthenticationOptions options = const AuthenticationOptions(),
  }) async {
    pedidas++;
    return true;
  }
}

Future<AuthProvider> _montar(
  WidgetTester tester,
  Widget pantalla,
  Map<String, String> guardado,
  _HuellaFalsa huella,
) async {
  final api = ApiService(
    client: MockClient((request) async {
      if (request.url.path.endsWith('/profile/mi-perfil')) {
        return http.Response(
          jsonEncode({'id': 'u1', 'nombre': 'Ana', 'apellido': 'Paz', 'correo': 'ana@gmail.com', 'rol': 'usuario'}),
          200,
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      }
      return http.Response('{}', 200);
    }),
  );
  final auth = AuthProvider(api: api, storage: _Memoria(guardado), localAuth: huella);
  await auth.bootstrap();
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: auth),
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
      ],
      child: MaterialApp(
        theme: AppTheme.light,
        // La pantalla de Perfil ya trae su propio Scaffold con lista desplazable.
        home: pantalla is PerfilScreen ? pantalla : Scaffold(body: SingleChildScrollView(child: pantalla)),
      ),
    ),
  );
  for (var i = 0; i < 6; i++) {
    await tester.pump(const Duration(milliseconds: 200));
  }
  return auth;
}

void main() {
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));

  testWidgets('el login solo muestra correo, contraseña, ingresar y olvidé mi contraseña', (tester) async {
    await _montar(tester, const LoginForm(), {}, _HuellaFalsa());

    expect(find.byType(TextFormField), findsNWidgets(2));
    expect(find.text('Ingresar al sistema'), findsOneWidget);
    expect(find.text('¿Olvidaste tu contraseña?'), findsOneWidget);
    expect(find.textContaining('código a mi correo'), findsNothing);
    expect(find.textContaining('huella o rostro'), findsNothing);
    expect(find.textContaining('biométrico'), findsNothing);
    expect(find.byType(CheckboxListTile), findsNothing);
  });

  testWidgets('con la huella activada tampoco aparecen botones extra, pero se pide al abrir', (tester) async {
    final huella = _HuellaFalsa();
    await _montar(
      tester,
      const LoginForm(),
      {'biometric_enabled': 'true', 'biometric_refresh_token': 'r'},
      huella,
    );

    expect(find.textContaining('huella o rostro'), findsNothing);
    expect(find.textContaining('Desactivar'), findsNothing);
    expect(huella.pedidas, 1, reason: 'la huella se pide sola al abrir la app');
  });

  testWidgets('en Ajustes se activa y desactiva el ingreso con huella o rostro', (tester) async {
    final huella = _HuellaFalsa();
    final guardado = {'access_token': 't', 'biometric_refresh_token': 'r'};
    final auth = await _montar(tester, const PerfilScreen(), guardado, huella);

    final interruptor = find.byKey(const ValueKey('ajuste-biometria'));
    await tester.scrollUntilVisible(interruptor, 200, scrollable: find.byType(Scrollable).first);
    expect(find.text('Ajustes'), findsOneWidget);
    expect(find.text('Apariencia'), findsOneWidget);
    await tester.pump(const Duration(milliseconds: 200));
    expect(tester.widget<SwitchListTile>(interruptor).value, isFalse, reason: 'cuenta nueva: desactivado');

    await tester.tap(interruptor);
    for (var i = 0; i < 6; i++) {
      await tester.pump(const Duration(milliseconds: 200));
    }
    expect(huella.pedidas, 1, reason: 'confirma con la huella antes de activar');
    expect(auth.biometricEnabled, isTrue);
    expect(guardado['biometric_enabled'], 'true');

    await tester.tap(interruptor);
    for (var i = 0; i < 6; i++) {
      await tester.pump(const Duration(milliseconds: 200));
    }
    expect(auth.biometricEnabled, isFalse);
    expect(guardado['biometric_refresh_token'], 'r', reason: 'la sesión puede seguir renovándose');
  });
}
