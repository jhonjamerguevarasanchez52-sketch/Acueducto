// Borrar una notificación deslizando la tarjeta: se quita al instante y, si
// el servidor falla, vuelve a aparecer con un mensaje de error.
import 'dart:convert';

import 'package:acueducto_app/providers/auth_provider.dart';
import 'package:acueducto_app/providers/theme_provider.dart';
import 'package:acueducto_app/screens/notificaciones_screen.dart';
import 'package:acueducto_app/services/api_service.dart';
import 'package:acueducto_app/theme/app_theme.dart';
import 'package:flutter/material.dart';
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

const _json = {'content-type': 'application/json; charset=utf-8'};

final _perfil = {
  'id': 'u1',
  'nombre': 'Ana',
  'apellido': 'Torres',
  'correo': 'ana@correo.com',
  'rol': 'usuario',
  'activo': true,
  'is_verified': true,
  'debe_cambiar_password': false,
  'zona': 'Centro',
};

final _avisos = [
  {
    'id': 'n1',
    'mensaje': 'Corte programado mañana',
    'tipo': 'corte',
    'estado': 'no_leido',
    'fecha': '2026-10-28T03:31:48.821+00:00',
  },
  {
    'id': 'n2',
    'mensaje': 'Nueva factura disponible',
    'tipo': 'factura',
    'estado': 'leido',
    'fecha': '2026-10-27T03:31:48.821+00:00',
  },
];

Future<({AuthProvider auth, List<String> borrados})> _sesion({
  required int estadoBorrado,
}) async {
  final borrados = <String>[];
  final api = ApiService(
    client: MockClient((request) async {
      final ruta = request.url.path.replaceFirst(RegExp(r'^.*?/api'), '');
      if (request.method == 'DELETE') {
        borrados.add(ruta);
        return estadoBorrado == 200
            ? http.Response('{}', 200, headers: _json)
            : http.Response(
                jsonEncode({'error': 'No se pudo borrar'}),
                estadoBorrado,
                headers: _json,
              );
      }
      if (ruta == '/profile/mi-perfil') {
        return http.Response(jsonEncode(_perfil), 200, headers: _json);
      }
      if (ruta == '/notificaciones') {
        return http.Response(jsonEncode(_avisos), 200, headers: _json);
      }
      return http.Response('[]', 200, headers: _json);
    }),
  );
  final auth = AuthProvider(api: api, storage: _Memoria());
  await auth.bootstrap();
  return (auth: auth, borrados: borrados);
}

Future<void> _montar(WidgetTester tester, AuthProvider auth) async {
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: auth),
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
      ],
      child: MaterialApp(
        theme: AppTheme.light,
        home: const NotificacionesScreen(),
      ),
    ),
  );
  for (var i = 0; i < 8; i++) {
    await tester.pump(const Duration(milliseconds: 250));
  }
}

void main() {
  testWidgets('deslizar una notificación la borra en el servidor', (
    tester,
  ) async {
    final s = await _sesion(estadoBorrado: 200);
    await _montar(tester, s.auth);

    expect(find.text('Corte programado mañana'), findsOneWidget);
    await tester.drag(
      find.text('Corte programado mañana'),
      const Offset(-600, 0),
    );
    for (var i = 0; i < 8; i++) {
      await tester.pump(const Duration(milliseconds: 250));
    }

    expect(find.text('Corte programado mañana'), findsNothing);
    expect(find.text('Nueva factura disponible'), findsOneWidget);
    expect(s.borrados, ['/notificaciones/n1']);
  });

  testWidgets('si el servidor falla, la notificación vuelve a su lugar', (
    tester,
  ) async {
    final s = await _sesion(estadoBorrado: 500);
    await _montar(tester, s.auth);

    await tester.drag(
      find.text('Corte programado mañana'),
      const Offset(-600, 0),
    );
    for (var i = 0; i < 8; i++) {
      await tester.pump(const Duration(milliseconds: 250));
    }

    expect(find.text('Corte programado mañana'), findsOneWidget);
    expect(find.text('No se pudo borrar'), findsOneWidget);
  });
}
