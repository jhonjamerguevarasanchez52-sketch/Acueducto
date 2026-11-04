// Recorre todas las pantallas con respuestas REALES capturadas del backend
// (test/fixtures/respuestas_backend.json) en varios tamaños, temas y roles,
// y falla ante cualquier excepción o desbordamiento de diseño.
import 'dart:convert';
import 'dart:io';

import 'package:acueducto_app/providers/auth_provider.dart';
import 'package:acueducto_app/providers/theme_provider.dart';
import 'package:acueducto_app/screens/admin/admin_api.dart';
import 'package:acueducto_app/screens/admin/admin_pagos_screen.dart';
import 'package:acueducto_app/screens/cambiar_password_obligatorio_screen.dart';
import 'package:acueducto_app/screens/cambiar_password_screen.dart';
import 'package:acueducto_app/screens/chat_screen.dart';
import 'package:acueducto_app/screens/editar_perfil_screen.dart';
import 'package:acueducto_app/screens/estado_servicio_screen.dart';
import 'package:acueducto_app/screens/login_screen.dart';
import 'package:acueducto_app/screens/main_shell.dart';
import 'package:acueducto_app/screens/olvide_password_screen.dart';
import 'package:acueducto_app/screens/pagos_screen.dart';
import 'package:acueducto_app/screens/recuperar_password_screen.dart';
import 'package:acueducto_app/screens/verificar_cuenta_screen.dart';
import 'package:acueducto_app/services/api_service.dart';
import 'package:acueducto_app/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:provider/provider.dart';

class _Memoria implements AuthSessionStorage {
  final valores = <String, String>{'access_token': 'token-de-prueba'};
  @override
  Future<String?> read(String key) async => valores[key];
  @override
  Future<void> write(String key, String value) async => valores[key] = value;
  @override
  Future<void> delete(String key) async => valores.remove(key);
}

final Map<String, dynamic> respuestas = jsonDecode(
  File('test/fixtures/respuestas_backend.json').readAsStringSync(),
);
final sinRespuesta = <String>{};

ApiService apiPara(String rol) {
  final datos = respuestas[rol] as Map<String, dynamic>;
  return ApiService(
    client: MockClient((request) async {
      final ruta = request.url.path
          .replaceFirst(RegExp(r'^.*?/api'), '')
          .replaceAll(RegExp(r'[0-9a-f]{8}-[0-9a-f-]{27}'), ':id');
      final clave = request.url.hasQuery ? '$ruta?${request.url.query}' : ruta;
      if (request.method == 'GET') {
        if (datos.containsKey(clave)) {
          return http.Response(jsonEncode(datos[clave]), 200,
              headers: {'content-type': 'application/json; charset=utf-8'});
        }
        sinRespuesta.add('$rol GET $clave');
        return http.Response('[]', 200);
      }
      return http.Response('{}', 200);
    }),
  );
}

Future<AuthProvider> sesion(String rol) async {
  final auth = AuthProvider(api: apiPara(rol), storage: _Memoria());
  await auth.bootstrap();
  expect(auth.status, AuthStatus.authenticated, reason: 'la sesión de $rol carga');
  return auth;
}

Future<void> montar(
  WidgetTester tester,
  Widget pantalla, {
  required AuthProvider auth,
  required Size tamano,
  required bool oscuro,
}) async {
  tester.view.physicalSize = tamano * 3;
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: auth),
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
      ],
      child: MaterialApp(
        theme: AppTheme.light,
        darkTheme: AppTheme.dark,
        themeMode: oscuro ? ThemeMode.dark : ThemeMode.light,
        home: pantalla,
      ),
    ),
  );
  await asentar(tester);
}

Future<void> asentar(WidgetTester tester) async {
  for (var i = 0; i < 8; i++) {
    await tester.pump(const Duration(milliseconds: 250));
  }
}

void sinErrores(WidgetTester tester, String donde) {
  final error = tester.takeException();
  expect(error, isNull, reason: '$donde: $error');
}

const tamanos = {
  'teléfono pequeño': Size(320, 568),
  'teléfono': Size(393, 852),
  'tableta': Size(800, 1280),
};

void main() {
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));

  for (final rol in ['usuario', 'administrador', 'fontanero']) {
    for (final MapEntry(key: nombre, value: tamano) in tamanos.entries) {
      for (final oscuro in [false, true]) {
        testWidgets('app completa · $rol · $nombre · ${oscuro ? 'oscuro' : 'claro'}', (tester) async {
          final auth = await sesion(rol);
          await montar(tester, const MainShell(), auth: auth, tamano: tamano, oscuro: oscuro);
          sinErrores(tester, 'inicio');
          for (final pestana in ['Factura', 'Averías', 'Avisos', 'Perfil', 'Inicio']) {
            await tester.tap(find.text(pestana).last);
            await asentar(tester);
            sinErrores(tester, 'pestaña $pestana');
          }
          // Abrir "Pagar" en cada factura pendiente muestra los planes reales.
          await tester.tap(find.text('Factura').last);
          await asentar(tester);
          var abiertas = 0;
          for (var i = 0; i < 4; i++) {
            final botones = find.widgetWithText(FilledButton, 'Pagar').evaluate().toList();
            if (botones.length <= i) break;
            final boton = find.byWidget(botones[i].widget);
            await tester.ensureVisible(boton);
            await tester.pump(const Duration(milliseconds: 100));
            await tester.tap(boton);
            await asentar(tester);
            sinErrores(tester, 'hoja de planes $i');
            final hoja = find.text('Pagar factura').evaluate().isNotEmpty;
            if (hoja && find.text('Más pagos').evaluate().isNotEmpty) {
              await tester.tap(find.text('Más pagos'));
              await asentar(tester);
              sinErrores(tester, 'más pagos $i');
            }
            if (hoja) abiertas++;
            // Cerrar con el botón "Atrás" del sistema.
            if (hoja) await tester.binding.handlePopRoute();
            await asentar(tester);
          }
          if (rol == 'usuario') {
            expect(abiertas, greaterThan(0), reason: 'el usuario con facturas pendientes puede abrir Pagar');
          }
        });
      }
    }
  }

  final sueltas = <String, Widget Function(ApiService)>{
    'login': (_) => const LoginScreen(),
    'olvidé contraseña': (_) => const OlvidePasswordScreen(correoInicial: 'ana@gmail.com'),
    'recuperar contraseña': (_) => const RecuperarPasswordScreen(correoInicial: 'ana@gmail.com'),
    'verificar cuenta': (_) => const VerificarCuentaScreen(correo: 'ana@gmail.com', password: 'x'),
    'cambiar contraseña': (_) => const CambiarPasswordScreen(),
    'cambio obligatorio': (_) => const CambiarPasswordObligatorioScreen(),
    'editar perfil': (_) => const EditarPerfilScreen(),
    'chat': (_) => const ChatScreen(),
    'mis pagos': (_) => const PagosScreen(),
    'estado del servicio': (_) => const EstadoServicioScreen(),
    'admin pagos': (api) => AdminPagosScreen(api: AdminApi(api)),
  };
  for (final MapEntry(key: nombre, value: crear) in sueltas.entries) {
    for (final MapEntry(key: tam, value: tamano) in tamanos.entries) {
      for (final oscuro in [false, true]) {
        testWidgets('pantalla $nombre · $tam · ${oscuro ? 'oscuro' : 'claro'}', (tester) async {
          final rol = nombre == 'admin pagos' ? 'administrador' : 'usuario';
          final auth = await sesion(rol);
          await montar(tester, crear(auth.api), auth: auth, tamano: tamano, oscuro: oscuro);
          sinErrores(tester, nombre);
        });
      }
    }
  }

  tearDownAll(() {
    if (sinRespuesta.isNotEmpty) {
      // ignore: avoid_print
      print('Rutas pedidas por la app sin respuesta capturada: ${sinRespuesta.join(', ')}');
    }
  });
}
