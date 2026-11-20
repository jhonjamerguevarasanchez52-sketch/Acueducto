import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';

/// URL base del backend del Acueducto Campo Amor.
///
/// - En el emulador de Android, `localhost` apunta al propio teléfono, así que
///   el host de la máquina de desarrollo se accede por `10.0.2.2`.
/// - En web, Windows, macOS, Linux e iOS simulador se usa `localhost`.
/// - Se puede sobreescribir en tiempo de compilación con:
///   `flutter run --dart-define=API_BASE_URL=https://mi-servidor/api`
class ApiConfig {
  ApiConfig._();

  static const String _override =
      String.fromEnvironment('API_BASE_URL', defaultValue: '');

  static String get baseUrl {
    if (_override.isNotEmpty) return _override;

    const port = 3000;
    if (!kIsWeb && Platform.isAndroid) {
      return 'http://10.0.2.2:$port/api';
    }
    return 'http://localhost:$port/api';
  }
}
