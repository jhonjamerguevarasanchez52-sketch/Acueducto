import 'dart:convert';

import 'package:acueducto_app/providers/auth_provider.dart';
import 'package:acueducto_app/services/api_service.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

class MemoryAuthSessionStorage implements AuthSessionStorage {
  final values = <String, String>{};

  @override
  Future<String?> read(String key) async => values[key];

  @override
  Future<void> write(String key, String value) async {
    values[key] = value;
  }

  @override
  Future<void> delete(String key) async {
    values.remove(key);
  }
}

void main() {
  test('login valida administrador, guarda tokens y carga el perfil', () async {
    final storage = MemoryAuthSessionStorage();
    final paths = <String>[];
    final client = MockClient((request) async {
      paths.add(request.url.path);
      if (request.url.path.endsWith('/auth/verificar-administrador')) {
        return http.Response('{}', 200);
      }
      if (request.url.path.endsWith('/auth/login')) {
        return http.Response(
          jsonEncode({
            'session': {
              'access_token': 'access-token',
              'refresh_token': 'refresh-token',
            },
          }),
          200,
        );
      }
      if (request.url.path.endsWith('/profile/mi-perfil')) {
        return http.Response(
          jsonEncode({
            'id': 'admin-1',
            'correo': 'admin@example.com',
            'nombre': 'Ana',
            'apellido': 'Pérez',
            'rol': 'administrador',
          }),
          200,
        );
      }
      return http.Response('{}', 404);
    });
    final provider = AuthProvider(
      api: ApiService(client: client),
      storage: storage,
    );
    addTearDown(provider.dispose);

    await provider.login('admin@example.com', 'contraseña-segura');

    expect(provider.status, AuthStatus.authenticated);
    expect(provider.profile?.nombreCompleto, 'Ana Pérez');
    expect(provider.api.authToken, 'access-token');
    expect(storage.values['access_token'], 'access-token');
    expect(storage.values['biometric_refresh_token'], 'refresh-token');
    expect(
      paths,
      containsAllInOrder([
        '/api/auth/verificar-administrador',
        '/api/auth/login',
        '/api/profile/mi-perfil',
      ]),
    );
  });

  test(
    'bootstrap con biometría habilitada exige autenticación y borra token normal',
    () async {
      final storage = MemoryAuthSessionStorage()
        ..values['biometric_enabled'] = 'true'
        ..values['access_token'] = 'token-anterior'
        ..values['biometric_refresh_token'] = 'refresh-seguro';
      final client = MockClient((_) async => http.Response('{}', 500));
      final provider = AuthProvider(
        api: ApiService(client: client),
        storage: storage,
      );
      addTearDown(provider.dispose);

      await provider.bootstrap();

      expect(provider.status, AuthStatus.unauthenticated);
      expect(provider.biometricEnabled, isTrue);
      expect(storage.values.containsKey('access_token'), isFalse);
      expect(storage.values['biometric_refresh_token'], 'refresh-seguro');
      expect(provider.api.authToken, isNull);
    },
  );

  test('desactivar biometría elimina el refresh token guardado', () async {
    final storage = MemoryAuthSessionStorage()
      ..values['biometric_enabled'] = 'true'
      ..values['biometric_refresh_token'] = 'refresh-seguro';
    final provider = AuthProvider(
      api: ApiService(
        client: MockClient((_) async => http.Response('{}', 200)),
      ),
      storage: storage,
    );
    addTearDown(provider.dispose);
    await provider.bootstrap();

    await provider.setBiometricEnabled(false);

    expect(provider.biometricEnabled, isFalse);
    expect(storage.values.containsKey('biometric_enabled'), isFalse);
    expect(storage.values.containsKey('biometric_refresh_token'), isFalse);
  });
}
