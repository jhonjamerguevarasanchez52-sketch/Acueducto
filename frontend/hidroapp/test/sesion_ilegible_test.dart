import 'package:acueducto_app/providers/auth_provider.dart';
import 'package:acueducto_app/services/api_service.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

/// Simula el almacenamiento seguro de un teléfono cuya llave ya no sirve
/// (datos restaurados de otro equipo): toda lectura lanza una excepción.
class _AlmacenRoto implements AuthSessionStorage {
  int borrados = 0;

  @override
  Future<String?> read(String key) async =>
      throw Exception('InvalidKeyException: Failed to unwrap key');

  @override
  Future<void> write(String key, String value) async {}

  @override
  Future<void> delete(String key) async => borrados++;
}

void main() {
  test(
    'una sesión guardada ilegible lleva al login en vez de quedarse cargando',
    () async {
      final almacen = _AlmacenRoto();
      final auth = AuthProvider(
        api: ApiService(
          client: MockClient((_) async => http.Response('{}', 200)),
        ),
        storage: almacen,
      );

      await auth.bootstrap();

      expect(auth.status, AuthStatus.unauthenticated);
      expect(auth.biometricEnabled, isFalse);
      expect(
        almacen.borrados,
        greaterThan(0),
        reason: 'se descarta la sesión dañada',
      );
    },
  );
}
