import 'dart:convert';

import 'package:acueducto_app/providers/auth_provider.dart';
import 'package:acueducto_app/providers/theme_provider.dart';
import 'package:acueducto_app/screens/averias_screen.dart';
import 'package:acueducto_app/services/api_service.dart';
import 'package:acueducto_app/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:provider/provider.dart';

class _Memoria implements AuthSessionStorage {
  final valores = <String, String>{'access_token': 't'};
  @override
  Future<String?> read(String key) async => valores[key];
  @override
  Future<void> write(String key, String value) async => valores[key] = value;
  @override
  Future<void> delete(String key) async => valores.remove(key);
}

Map<String, dynamic> averia(String id, String estado) => {
      'id': id,
      'perfil_id': 'u1',
      'descripcion': 'Fuga grande en el tubo principal frente a la escuela',
      'estado': estado,
      'fecha_reporte': '2026-10-20T10:00:00Z',
      'direccion': 'Calle 5 # 3-20',
      'zona': 'Centro',
      'reportante': {'nombre': 'Ana', 'apellido': 'Paz', 'telefono': '3001112233'},
    };

Future<List<http.Request>> montar(WidgetTester tester, String rol) async {
  final peticiones = <http.Request>[];
  final api = ApiService(
    client: MockClient((request) async {
      peticiones.add(request);
      final ruta = request.url.path;
      if (ruta.endsWith('/profile/mi-perfil')) {
        return http.Response(jsonEncode({'id': 'yo', 'nombre': 'Leo', 'apellido': 'Ruiz', 'correo': 'leo@gmail.com', 'rol': rol}), 200);
      }
      if (request.method == 'PUT') return http.Response(jsonEncode({'data': {}}), 200);
      return http.Response(
        jsonEncode({
          'data': [averia('a1', 'reportada'), averia('a2', 'en_proceso'), averia('a3', 'resuelta')],
        }),
        200,
      );
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
      child: MaterialApp(theme: AppTheme.light, home: const AveriasScreen()),
    ),
  );
  for (var i = 0; i < 8; i++) {
    await tester.pump(const Duration(milliseconds: 250));
  }
  return peticiones;
}

void main() {
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));

  testWidgets('el fontanero toma una avería y ve los datos del reportante', (tester) async {
    final peticiones = await montar(tester, 'fontanero');
    expect(find.text('Tomar avería'), findsOneWidget);
    expect(find.text('Marcar resuelta'), findsOneWidget);
    expect(find.text('Cancelar'), findsNWidgets(2), reason: 'la resuelta no tiene botones');
    expect(find.textContaining('Calle 5'), findsWidgets);
    expect(find.text('3001112233'), findsWidgets);

    await tester.tap(find.text('Tomar avería'));
    await tester.pump(const Duration(milliseconds: 300));
    await tester.enterText(find.byType(TextField), 'Voy en camino');
    await tester.tap(find.text('Tomar'));
    for (var i = 0; i < 6; i++) {
      await tester.pump(const Duration(milliseconds: 250));
    }

    final put = peticiones.singleWhere((r) => r.method == 'PUT');
    expect(put.url.path, endsWith('/averias/a1'));
    expect(jsonDecode(put.body), {'estado': 'en_proceso', 'nota': 'Voy en camino'});
  });

  testWidgets('volver en el diálogo no cambia nada', (tester) async {
    final peticiones = await montar(tester, 'fontanero');
    await tester.ensureVisible(find.text('Marcar resuelta'));
    await tester.pump(const Duration(milliseconds: 100));
    await tester.tap(find.text('Marcar resuelta'));
    await tester.pump(const Duration(milliseconds: 300));
    await tester.tap(find.text('Volver'));
    await tester.pump(const Duration(milliseconds: 300));
    expect(peticiones.where((r) => r.method == 'PUT'), isEmpty);
  });

  for (final rol in ['usuario', 'administrador']) {
    testWidgets('$rol no puede cambiar el estado de las averías', (tester) async {
      await montar(tester, rol);
      expect(find.text('Tomar avería'), findsNothing);
      expect(find.text('Marcar resuelta'), findsNothing);
    });
  }
}
