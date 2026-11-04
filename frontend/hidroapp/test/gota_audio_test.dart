import 'dart:convert';

import 'package:acueducto_app/providers/auth_provider.dart';
import 'package:acueducto_app/providers/theme_provider.dart';
import 'package:acueducto_app/screens/averias_screen.dart';
import 'package:acueducto_app/screens/chat_screen.dart';
import 'package:acueducto_app/services/api_service.dart';
import 'package:acueducto_app/services/audio_gota_service.dart';
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

/// Micrófono falso: "graba" 4 segundos sin tocar el plugin.
class _AudioFalso extends AudioGotaService {
  @override
  Future<bool> iniciar() async => true;
  @override
  Duration get transcurrido => const Duration(seconds: 4);
  @override
  Future<AudioGrabado?> detener() async =>
      AudioGrabado([1, 2, 3], const Duration(seconds: 4));
  @override
  Future<void> cancelar() async {}
}

typedef Responder = http.Response Function(http.Request request);

Future<List<http.Request>> montar(
  WidgetTester tester, {
  required String rol,
  required Widget pantalla,
  required Responder responder,
}) async {
  final peticiones = <http.Request>[];
  final api = ApiService(
    client: MockClient((request) async {
      if (request.url.path.endsWith('/profile/mi-perfil')) {
        return http.Response(
          jsonEncode({'id': 'yo', 'nombre': 'Leo', 'apellido': 'Ruiz', 'correo': 'leo@gmail.com', 'rol': rol}),
          200,
        );
      }
      peticiones.add(request);
      return responder(request);
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
      child: MaterialApp(theme: AppTheme.light, home: pantalla),
    ),
  );
  await esperar(tester);
  return peticiones;
}

Future<void> esperar(WidgetTester tester) async {
  for (var i = 0; i < 6; i++) {
    await tester.pump(const Duration(milliseconds: 250));
  }
}

http.Response json(Object cuerpo, [int status = 200]) => http.Response(
      jsonEncode(cuerpo),
      status,
      headers: {'content-type': 'application/json; charset=utf-8'},
    );

void main() {
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));

  testWidgets('la avería solo se registra al tocar el botón de confirmación', (tester) async {
    final peticiones = await montar(
      tester,
      rol: 'usuario',
      pantalla: ChatScreen(audio: _AudioFalso()),
      responder: (request) {
        final body = jsonDecode(request.body) as Map;
        if (body['confirmarAveria'] == true) {
          return json({'respuesta': 'Avería registrada. Ya estoy avisando al fontanero.'}, 201);
        }
        return json({
          'respuesta': '¿Quieres que la registre y avise al fontanero?',
          'accion': {'tipo': 'confirmar_averia', 'descripcion': 'Fuga en el patio'},
        });
      },
    );

    await tester.enterText(find.byType(TextField), 'Hay una fuga en el patio');
    await tester.pump();
    await tester.tap(find.byTooltip('Enviar'));
    await esperar(tester);

    expect(find.text('Sí, avisar al fontanero'), findsOneWidget);
    expect(peticiones, hasLength(1), reason: 'proponer no registra nada');

    await tester.tap(find.text('Sí, avisar al fontanero'));
    await esperar(tester);

    expect(jsonDecode(peticiones.last.body), {'confirmarAveria': true, 'descripcion': 'Fuga en el patio'});
    expect(find.textContaining('Avería registrada'), findsOneWidget);
    expect(find.widgetWithText(FilledButton, 'Sí, avisar al fontanero'), findsNothing,
        reason: 'el botón no se ofrece dos veces');
  });

  testWidgets('el audio se transcribe, se revisa en el campo y viaja con su id', (tester) async {
    final peticiones = await montar(
      tester,
      rol: 'usuario',
      pantalla: ChatScreen(audio: _AudioFalso()),
      responder: (request) {
        if (request.url.path.endsWith('/chat/audio')) {
          return json({'transcripcion': 'Se rompió el tubo de la esquina', 'audioId': 'au1'});
        }
        return json({'respuesta': 'Entiendo, cuéntame más.'});
      },
    );

    await tester.tap(find.byTooltip('Enviar un audio'));
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('Cuéntale a GOTA qué pasó'), findsOneWidget);

    await tester.tap(find.byTooltip('Terminar audio'));
    await esperar(tester);

    final audio = peticiones.single;
    expect(audio.headers['content-type'], 'audio/mp4');
    expect(audio.headers['x-audio-duracion'], '4');
    expect(find.textContaining('Esto entendí de tu audio'), findsOneWidget);
    final campo = tester.widget<TextField>(find.byType(TextField));
    expect(campo.controller!.text, 'Se rompió el tubo de la esquina');

    await tester.enterText(find.byType(TextField), 'Se rompió el tubo de la esquina de la escuela');
    await tester.pump();
    await tester.tap(find.byTooltip('Enviar'));
    await esperar(tester);

    final mensaje = jsonDecode(peticiones.last.body) as Map;
    expect(mensaje['mensaje'], 'Se rompió el tubo de la esquina de la escuela');
    expect(mensaje['audioIds'], ['au1']);
    expect(find.text('Audio'), findsOneWidget, reason: 'la burbuja marca que vino de un audio');
  });

  testWidgets('si se acaba el cupo de audios, se avisa y se puede seguir escribiendo', (tester) async {
    await montar(
      tester,
      rol: 'usuario',
      pantalla: ChatScreen(audio: _AudioFalso()),
      responder: (_) => json({'error': 'Por hoy ya usaste tus 5 audios 🎤. Escríbeme y te ayudo igual.'}, 429),
    );

    await tester.tap(find.byTooltip('Enviar un audio'));
    await tester.pump(const Duration(milliseconds: 300));
    await tester.tap(find.byTooltip('Terminar audio'));
    await esperar(tester);

    expect(find.textContaining('ya usaste tus 5 audios'), findsOneWidget);
    expect(find.byType(TextField), findsOneWidget);
  });

  testWidgets('el fontanero no ve el micrófono en el chat', (tester) async {
    await montar(
      tester,
      rol: 'fontanero',
      pantalla: ChatScreen(audio: _AudioFalso()),
      responder: (_) => json({}),
    );
    expect(find.byTooltip('Enviar un audio'), findsNothing);
  });

  group('audios en la lista del fontanero', () {
    Map<String, dynamic> averiaConAudios() => {
          'id': 'a1',
          'perfil_id': 'u1',
          'descripcion': 'Fuga grande frente a la escuela',
          'estado': 'reportada',
          'fecha_reporte': '2026-10-20T10:00:00Z',
          'reportante': {'nombre': 'Ana', 'apellido': 'Paz'},
          'audios': [
            {
              'id': 'au1',
              'duracion_s': 12,
              'transcripcion': 'Fuga grande frente a la escuela',
              'disponible': true,
              'expira_en': DateTime.now().add(const Duration(days: 10)).toIso8601String(),
            },
            {
              'id': 'au2',
              'duracion_s': 65,
              'transcripcion': 'Otra vez la fuga',
              'disponible': false,
            },
          ],
        };

    testWidgets('muestra cuánto falta para borrar el audio y cuáles ya se borraron', (tester) async {
      await montar(
        tester,
        rol: 'fontanero',
        pantalla: const AveriasScreen(),
        responder: (_) => json({'data': [averiaConAudios()]}),
      );

      expect(find.text('Audio del usuario · 0:12'), findsOneWidget);
      expect(find.textContaining('Se borra en'), findsOneWidget);
      expect(find.byTooltip('Escuchar audio'), findsOneWidget);
      expect(find.text('Audio del usuario · 1:05'), findsOneWidget);
      expect(find.textContaining('El audio ya se borró'), findsOneWidget);
    });

    testWidgets('el usuario no ve audios en sus averías', (tester) async {
      await montar(
        tester,
        rol: 'usuario',
        pantalla: const AveriasScreen(),
        responder: (_) => json({'data': [averiaConAudios()]}),
      );
      expect(find.textContaining('Audio del usuario'), findsNothing);
    });
  });

  group('ApiService ante un servidor dormido', () {
    test('reintenta una vez los GET tras un fallo de red', () async {
      var intentos = 0;
      final api = ApiService(
        client: MockClient((_) async {
          intentos += 1;
          if (intentos == 1) throw http.ClientException('conexión reiniciada');
          return http.Response('{"ok":true}', 200);
        }),
      );
      addTearDown(api.dispose);

      expect(await api.get('/averias'), {'ok': true});
      expect(intentos, 2);
    });

    test('no reintenta los POST: podrían repetir un cambio', () async {
      var intentos = 0;
      final api = ApiService(
        client: MockClient((_) async {
          intentos += 1;
          throw http.ClientException('conexión reiniciada');
        }),
      );
      addTearDown(api.dispose);

      await expectLater(api.post('/chat', body: {}), throwsA(isA<ApiException>()));
      expect(intentos, 1);
    });
  });
}
