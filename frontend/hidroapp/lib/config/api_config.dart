import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';

/// URL base del backend del Acueducto Campo Amor.
///
/// - Por defecto usa el servidor de Render (`useRemote = true`).
/// - Con `useRemote = false`, en el emulador de Android usa `10.0.2.2`
///   y en el resto de plataformas `localhost`.
/// - Se puede sobreescribir al compilar con:
///   `flutter run --dart-define=API_BASE_URL=https://mi-servidor/api`
class ApiConfig {
  ApiConfig._();

  static const bool useRemote = true;

  static const String _remoteUrl = 'https://hidro-app.onrender.com/api';

  static const String _override =
      String.fromEnvironment('API_BASE_URL', defaultValue: '');
  static const bool _allowInsecureLocalApi =
      bool.fromEnvironment('ALLOW_INSECURE_LOCAL_API', defaultValue: true);

  static String get baseUrl {
    // 1. Si se pasó --dart-define, tiene prioridad (validado en release).
    if (_override.isNotEmpty) {
      if (kReleaseMode &&
          !_override.startsWith('https://') &&
          !(_allowInsecureLocalApi && _isPrivateHttpUrl(_override))) {
        throw StateError('API_BASE_URL debe ser https:// en un build de release.');
      }
      return _override;
    }

    // 2. Servidor remoto en Render.
    if (useRemote) return _remoteUrl;

    // 3. Desarrollo local.
    if (kReleaseMode) {
      throw StateError(
        'Un build de release no puede usar el servidor local. '
        'Activa useRemote o pasa --dart-define=API_BASE_URL=https://...',
      );
    }
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