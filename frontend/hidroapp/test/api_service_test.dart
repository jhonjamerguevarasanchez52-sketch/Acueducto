import 'dart:convert';

import 'package:acueducto_app/services/api_service.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  test(
    'decodifica una respuesta JSON exitosa y envía el token de sesión',
    () async {
      http.BaseRequest? capturedRequest;
      final client = MockClient((request) async {
        capturedRequest = request;
        return http.Response(jsonEncode({'nombre': 'Ana'}), 200);
      });
      final api = ApiService(client: client)..authToken = 'token-prueba';
      addTearDown(api.dispose);

      final result = await api.get('/profile/mi-perfil');

      expect(result, {'nombre': 'Ana'});
      expect(capturedRequest?.headers['Authorization'], 'Bearer token-prueba');
      expect(capturedRequest?.headers['Content-Type'], 'application/json');
    },
  );

  test('codifica el body JSON de una solicitud POST', () async {
    http.Request? capturedRequest;
    final client = MockClient((request) async {
      capturedRequest = request;
      return http.Response('{}', 200);
    });
    final api = ApiService(client: client);
    addTearDown(api.dispose);

    await api.post('/auth/login', body: {'correo': 'ana@example.com'});

    expect(capturedRequest?.method, 'POST');
    expect(jsonDecode(capturedRequest!.body), {'correo': 'ana@example.com'});
  });

  test(
    'notifica sesión expirada y conserva código y datos del error 401',
    () async {
      final client = MockClient(
        (_) async =>
            http.Response(jsonEncode({'error': 'La sesión expiró'}), 401),
      );
      final api = ApiService(client: client);
      var unauthorizedCalls = 0;
      api.onUnauthorized = () => unauthorizedCalls += 1;
      addTearDown(api.dispose);

      await expectLater(
        api.get('/profile/mi-perfil'),
        throwsA(
          isA<ApiException>().having(
            (error) => error.statusCode,
            'statusCode',
            401,
          ),
        ),
      );
      expect(unauthorizedCalls, 1);
    },
  );

  test('convierte un error sin JSON al mensaje HTTP esperado', () async {
    final client = MockClient((_) async => http.Response('bad gateway', 502));
    final api = ApiService(client: client);
    addTearDown(api.dispose);

    await expectLater(
      api.get('/health'),
      throwsA(
        isA<ApiException>()
            .having((error) => error.statusCode, 'statusCode', 502)
            .having((error) => error.message, 'message', 'Error 502'),
      ),
    );
  });
}
