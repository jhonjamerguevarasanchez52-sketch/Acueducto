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
  static const bool _allowInsecureLocalApi =
      bool.fromEnvironment('ALLOW_INSECURE_LOCAL_API', defaultValue: false);

  static String get baseUrl {
    if (kReleaseMode) {
      // En un build de release no hay dev server local: si no se pasó
      // --dart-define=API_BASE_URL=https://..., es un error de compilación,
      // no algo que deba degradar silenciosamente a localhost/HTTP.
      if (_override.isEmpty) {
        throw StateError(
          'API_BASE_URL no está definido. Compila con '
          '--dart-define=API_BASE_URL=https://tu-backend/api',
        );
      }
      if (_override.startsWith('https://')) return _override;
      if (_allowInsecureLocalApi && _isPrivateHttpUrl(_override)) {
        return _override;
      }
      if (!_override.startsWith('https://')) {
        throw StateError('API_BASE_URL debe ser https:// en un build de release.');
      }
    }

    if (_override.isNotEmpty) return _override;

    const port = 3000;
    if (!kIsWeb && Platform.isAndroid) {
      return 'http://10.0.2.2:$port/api';
    }
    return 'http://localhost:$port/api';
  }

  static bool _isPrivateHttpUrl(String value) {
    final uri = Uri.tryParse(value);
    if (uri == null || uri.scheme != 'http') return false;
    return RegExp(
      r'^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})$',
    ).hasMatch(uri.host);
  }
}
