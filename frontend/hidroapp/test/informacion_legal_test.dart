import 'package:flutter_test/flutter_test.dart';
import 'package:acueducto_app/config/api_config.dart';

void main() {
  group('Información legal (Perfil)', () {
    test('la política de privacidad apunta a la página pública del backend', () {
      expect(
        ApiConfig.politicaPrivacidadUrl,
        'https://hidro-app.onrender.com/privacidad',
      );
    });

    test('la eliminación de cuenta apunta a la página pública del backend', () {
      expect(
        ApiConfig.eliminarCuentaUrl,
        'https://hidro-app.onrender.com/eliminar-cuenta',
      );
    });

    test('el healthcheck sigue en la misma URL', () {
      expect(ApiConfig.healthUrl, 'https://hidro-app.onrender.com/health');
    });
  });
}
