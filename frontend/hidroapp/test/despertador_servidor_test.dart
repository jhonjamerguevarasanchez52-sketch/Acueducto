import 'package:acueducto_app/config/api_config.dart';
import 'package:acueducto_app/services/despertador_servidor.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  test('la URL de salud vive fuera de /api', () {
    expect(ApiConfig.healthUrl, endsWith('/health'));
    expect(ApiConfig.healthUrl, isNot(contains('/api/')));
  });

  test(
    'despierta el servidor y no repite el aviso antes de 10 minutos',
    () async {
      final rutas = <String>[];
      var ahora = DateTime(2026, 11, 13, 8);
      final despertador = DespertadorServidor(
        client: MockClient((request) async {
          rutas.add(request.url.path);
          return http.Response('{"status":"ok"}', 200);
        }),
        reloj: () => ahora,
      );

      expect(await despertador.despertar(), isTrue);
      ahora = ahora.add(const Duration(minutes: 5));
      expect(await despertador.despertar(), isFalse);
      ahora = ahora.add(const Duration(minutes: 6));
      expect(await despertador.despertar(), isTrue);

      expect(rutas, ['/health', '/health']);
    },
  );

  test('un fallo de red no lanza errores', () async {
    final despertador = DespertadorServidor(
      client: MockClient((_) async => throw Exception('sin internet')),
    );
    expect(await despertador.despertar(), isTrue);
  });
}
