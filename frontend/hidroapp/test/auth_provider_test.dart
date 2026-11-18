import 'dart:convert';

import 'package:acueducto_app/providers/auth_provider.dart';
import 'package:acueducto_app/services/api_service.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:local_auth/local_auth.dart';

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
  test('login de cualquier rol guarda tokens y carga el perfil', () async {
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
      containsAllInOrder(['/api/auth/login', '/api/profile/mi-perfil']),
    );
    // La app móvil ya no exige que la cuenta sea de administrador.
    expect(paths, isNot(contains('/api/auth/verificar-administrador')));
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

  test('bootstrap con biometría pide la huella automáticamente una vez', () async {
    final storage = MemoryAuthSessionStorage()
      ..values['biometric_enabled'] = 'true'
      ..values['biometric_refresh_token'] = 'refresh-seguro';
    final provider = AuthProvider(
      api: ApiService(
        client: MockClient((_) async => http.Response('{}', 500)),
      ),
      storage: storage,
    );
    addTearDown(provider.dispose);

    await provider.bootstrap();

    expect(provider.tomarBiometriaAlIniciar(), isTrue);
    // Tras usarlo (o tras un logout manual) ya no se vuelve a lanzar sola.
    expect(provider.tomarBiometriaAlIniciar(), isFalse);
  });

  test(
    'token vencido se renueva con el refresh token y se reintenta la petición',
    () async {
      final storage = MemoryAuthSessionStorage()
        ..values['access_token'] = 'token-vencido'
        ..values['biometric_refresh_token'] = 'refresh-1';
      var renovaciones = 0;
      final client = MockClient((request) async {
        if (request.url.path.endsWith('/auth/renovar-sesion')) {
          renovaciones += 1;
          expect(jsonDecode(request.body)['refreshToken'], 'refresh-1');
          return http.Response(
            jsonEncode({
              'session': {
                'access_token': 'token-nuevo',
                'refresh_token': 'refresh-2',
              },
            }),
            200,
          );
        }
        if (request.headers['Authorization'] != 'Bearer token-nuevo') {
          return http.Response(jsonEncode({'error': 'jwt expired'}), 401);
        }
        return http.Response(
          jsonEncode({
            'id': 'u-1',
            'correo': 'u@example.com',
            'nombre': 'Ana',
            'apellido': 'Pérez',
            'rol': 'suscriptor',
          }),
          200,
        );
      });
      final provider = AuthProvider(
        api: ApiService(client: client),
        storage: storage,
      );
      addTearDown(provider.dispose);

      await provider.bootstrap();
      // Varias peticiones con 401 a la vez comparten una sola renovación.
      await Future.wait([
        provider.refreshProfile(),
        provider.refreshProfile(),
      ]);

      expect(provider.status, AuthStatus.authenticated);
      expect(renovaciones, 1);
      expect(provider.api.authToken, 'token-nuevo');
      expect(storage.values['access_token'], 'token-nuevo');
      expect(storage.values['biometric_refresh_token'], 'refresh-2');
    },
  );

  test('desactivar biometría conserva el refresh token para renovar la sesión', () async {
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
    // Sin él, la sesión se cerraría cada hora al vencer el token.
    expect(storage.values['biometric_refresh_token'], 'refresh-seguro');
  });

  group('activar la biometría desde Ajustes', () {
    AuthProvider proveedor(MemoryAuthSessionStorage storage, _HuellaFalsa huella) {
      final provider = AuthProvider(
        api: ApiService(client: MockClient((_) async => http.Response('{}', 200))),
        storage: storage,
        localAuth: huella,
      );
      addTearDown(provider.dispose);
      return provider;
    }

    test('pide la huella y, si la confirma, queda activa', () async {
      final storage = MemoryAuthSessionStorage()..values['biometric_refresh_token'] = 'r';
      final huella = _HuellaFalsa(confirma: true);
      final provider = proveedor(storage, huella);

      expect(await provider.setBiometricEnabled(true), isTrue);
      expect(huella.pedidas, 1);
      expect(provider.biometricEnabled, isTrue);
      expect(storage.values['biometric_enabled'], 'true');
    });

    test('si cancela la huella, sigue desactivada', () async {
      final storage = MemoryAuthSessionStorage()..values['biometric_refresh_token'] = 'r';
      final provider = proveedor(storage, _HuellaFalsa(confirma: false));

      expect(await provider.setBiometricEnabled(true), isFalse);
      expect(provider.biometricEnabled, isFalse);
      expect(storage.values.containsKey('biometric_enabled'), isFalse);
    });

    test('sin huella ni rostro en el teléfono explica por qué no se puede', () async {
      final storage = MemoryAuthSessionStorage()..values['biometric_refresh_token'] = 'r';
      final provider = proveedor(storage, _HuellaFalsa(confirma: true, soportada: false));

      expect(
        () => provider.setBiometricEnabled(true),
        throwsA(isA<ApiException>()),
      );
    });

    test('una cuenta nueva no tiene biometría hasta activarla', () async {
      final storage = MemoryAuthSessionStorage();
      final provider = proveedor(storage, _HuellaFalsa(confirma: true));
      await provider.bootstrap();
      expect(provider.biometricEnabled, isFalse);
      expect(provider.tomarBiometriaAlIniciar(), isFalse);
    });
  });
}

/// Simula el sensor de huella o rostro del teléfono.
class _HuellaFalsa extends LocalAuthentication {
  _HuellaFalsa({required this.confirma, this.soportada = true});

  final bool confirma;
  final bool soportada;
  int pedidas = 0;

  @override
  Future<bool> isDeviceSupported() async => soportada;

  @override
  Future<List<BiometricType>> getAvailableBiometrics() async =>
      soportada ? [BiometricType.fingerprint] : [];

  @override
  Future<bool> authenticate({
    required String localizedReason,
    Iterable<Object?> authMessages = const [],
    AuthenticationOptions options = const AuthenticationOptions(),
  }) async {
    pedidas++;
    return confirma;
  }
}
