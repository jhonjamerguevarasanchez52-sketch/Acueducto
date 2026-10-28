import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:local_auth/local_auth.dart';

import '../models/profile.dart';
import '../services/api_service.dart';

enum AuthStatus { unknown, authenticated, unauthenticated }

abstract interface class AuthSessionStorage {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> delete(String key);
}

class FlutterAuthSessionStorage implements AuthSessionStorage {
  FlutterAuthSessionStorage([FlutterSecureStorage? storage])
    : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  @override
  Future<String?> read(String key) => _storage.read(key: key);

  @override
  Future<void> write(String key, String value) =>
      _storage.write(key: key, value: value);

  @override
  Future<void> delete(String key) => _storage.delete(key: key);
}

/// Maneja la sesión del usuario: token de Supabase, perfil y llamadas de auth.
class AuthProvider extends ChangeNotifier {
  AuthProvider({ApiService? api, AuthSessionStorage? storage})
    : _api = api ?? ApiService(),
      _storage = storage ?? FlutterAuthSessionStorage() {
    _api.onUnauthorized = _manejarSesionExpirada;
  }

  final ApiService _api;
  final AuthSessionStorage _storage;

  static const _tokenKey = 'access_token';
  static const _refreshTokenKey = 'biometric_refresh_token';
  static const _biometricEnabledKey = 'biometric_enabled';

  AuthStatus _status = AuthStatus.unknown;
  Profile? _profile;

  AuthStatus get status => _status;
  Profile? get profile => _profile;
  ApiService get api => _api;
  bool get biometricEnabled => _biometricEnabled;
  bool _biometricEnabled = false;
  final LocalAuthentication _localAuth = LocalAuthentication();

  /// `true` cuando la cuenta tiene pendiente cambiar una contraseña temporal
  /// (generada por un administrador al crearla). Mientras sea `true`,
  /// [AuthGate] debe mostrar la pantalla de cambio obligatorio en vez de la
  /// app normal.
  bool get debeCambiarPassword => _profile?.debeCambiarPassword ?? false;

  /// Comprueba que el correo esté asociado a un administrador. Lo usa el
  /// panel administrativo; los suscriptores inician sesión directamente.
  Future<void> verificarCorreoAdministrador(String correo) async {
    await _api.post(
      '/auth/verificar-administrador',
      body: {'correo': correo.trim().toLowerCase()},
    );
  }

  /// Se llama al arrancar la app: intenta restaurar la sesión guardada.
  Future<void> bootstrap() async {
    _biometricEnabled = await _storage.read(_biometricEnabledKey) == 'true';
    if (_biometricEnabled) {
      // Si el usuario eligió biometría, cada apertura de la app pide su
      // confirmación antes de restaurar la sesión guardada.
      await _storage.delete(_tokenKey);
      _api.authToken = null;
      _setStatus(AuthStatus.unauthenticated);
      return;
    }
    notifyListeners();
    final token = await _storage.read(_tokenKey);
    if (token == null || token.isEmpty) {
      _setStatus(AuthStatus.unauthenticated);
      return;
    }

    _api.authToken = token;
    try {
      await _loadProfile();
      _setStatus(AuthStatus.authenticated);
    } on ApiException catch (e) {
      // Solo borramos la sesión guardada si el propio servidor la rechazó
      // (token inválido o expirado). Un error de red/timeout no debe forzar
      // un nuevo login: seguimos mostrando la pantalla de acceso, pero el
      // usuario podrá reintentar sin perder el token guardado.
      if (e.statusCode == 401 || e.statusCode == 403) {
        await _clear(preserveBiometric: _biometricEnabled);
      } else {
        _api.authToken = null;
      }
      _setStatus(AuthStatus.unauthenticated);
    } catch (_) {
      _api.authToken = null;
      _setStatus(AuthStatus.unauthenticated);
    }
  }

  Future<void> login(String correo, String password) async {
    final data = await _api.post('/auth/login', body: {
      'correo': correo.trim(),
      'password': password,
    });

    String? token;
    try {
      if (data is Map && data['session'] is Map) {
        final accessToken = (data['session'] as Map)['access_token'];
        if (accessToken is String) token = accessToken;
      }
    } catch (_) {
      token = null;
    }
    if (token == null || token.isEmpty) {
      throw ApiException(
        'La respuesta del servidor no incluyó una sesión válida.',
      );
    }

    await _storage.write(_tokenKey, token);
    final refreshToken = (data['session'] as Map)['refresh_token'];
    if (refreshToken is String && refreshToken.isNotEmpty) {
      await _storage.write(_refreshTokenKey, refreshToken);
    }
    _api.authToken = token;
    await _loadProfile();
    _setStatus(AuthStatus.authenticated);
  }

  Future<bool> deviceSupportsBiometrics() async {
    try {
      return await _localAuth.isDeviceSupported() &&
          (await _localAuth.getAvailableBiometrics()).isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  Future<void> setBiometricEnabled(bool enabled) async {
    if (enabled) {
      final supported = await deviceSupportsBiometrics();
      if (!supported) {
        throw ApiException('Este dispositivo no tiene biometría configurada.');
      }
      final refreshToken = await _storage.read(_refreshTokenKey);
      if (refreshToken == null || refreshToken.isEmpty) {
        throw ApiException(
          'Inicia sesión nuevamente para habilitar el acceso biométrico.',
        );
      }
      await _storage.write(_biometricEnabledKey, 'true');
    } else {
      await _storage.delete(_biometricEnabledKey);
      await _storage.delete(_refreshTokenKey);
    }
    _biometricEnabled = enabled;
    notifyListeners();
  }

  Future<void> loginWithBiometrics() async {
    if (!_biometricEnabled) {
      throw ApiException('El acceso biométrico está desactivado.');
    }
    final refreshToken = await _storage.read(_refreshTokenKey);
    if (refreshToken == null || refreshToken.isEmpty) {
      throw ApiException(
        'Ingresa con tu correo y contraseña para volver a habilitar la biometría.',
      );
    }
    final ok = await _localAuth.authenticate(
      localizedReason: 'Confirma tu identidad para ingresar a HIDROAPP',
      options: const AuthenticationOptions(biometricOnly: true),
    );
    if (!ok) return;
    final data = await _api.post(
      '/auth/renovar-sesion',
      body: {'refreshToken': refreshToken},
    );
    if (data is! Map || data['session'] is! Map) {
      throw ApiException(
        'No se pudo renovar la sesión. Ingresa con tu contraseña.',
      );
    }
    final session = data['session'] as Map;
    final token = session['access_token'];
    final nuevoRefresh = session['refresh_token'];
    if (token is! String || token.isEmpty) {
      throw ApiException('La sesión recibida no es válida.');
    }
    await _storage.write(_tokenKey, token);
    if (nuevoRefresh is String && nuevoRefresh.isNotEmpty) {
      await _storage.write(_refreshTokenKey, nuevoRefresh);
    }
    _api.authToken = token;
    await _loadProfile();
    _setStatus(AuthStatus.authenticated);
  }

  // No hay auto-registro: las cuentas las crea el administrador del acueducto.

  /// Confirma el código de 6 dígitos que se envió por correo al crear la cuenta.
  /// Si el código es correcto, deja iniciada la sesión con [password].
  Future<void> verificarCuenta(
    String correo,
    String codigo,
    String password,
  ) async {
    await _api.post('/auth/verificar', body: {
      'correo': correo.trim(),
      'codigo': codigo.trim(),
    });
    await login(correo, password);
  }

  /// Pide al backend que reenvíe el código de verificación a [correo].
  Future<void> reenviarCodigoVerificacion(String correo) async {
    await _api.post('/auth/reenviar-codigo', body: {'correo': correo.trim()});
  }

  /// Pide al backend que envíe un código de recuperación de contraseña al
  /// correo. Por seguridad responde igual exista o no la cuenta.
  Future<void> solicitarRecuperacion(String correo) async {
    await _api.post('/auth/solicitar-recuperacion',
        body: {'correo': correo.trim()});
  }

  /// Restablece la contraseña (sin sesión) con el código recibido por correo.
  Future<void> resetearPassword(
    String correo,
    String codigo,
    String nuevaPassword,
  ) async {
    await _api.post('/auth/resetear-password', body: {
      'correo': correo.trim(),
      'codigo': codigo.trim(),
      'nuevaPassword': nuevaPassword,
    });
  }

  /// Cambia la contraseña de la cuenta ya autenticada. Se usa para el cambio
  /// obligatorio tras el primer login con una contraseña temporal, pero sirve
  /// igual para un cambio voluntario. Al terminar, refresca el perfil para
  /// que [debeCambiarPassword] pase a `false` y [AuthGate] deje entrar a la app.
  Future<void> cambiarPassword(
    String passwordActual,
    String passwordNueva,
  ) async {
    await _api.post(
      '/auth/cambiar-password',
      body: {'passwordActual': passwordActual, 'passwordNueva': passwordNueva},
    );
    await _loadProfile();
    notifyListeners();
  }

  /// Vuelve a pedir el perfil al backend (p. ej. tras editarlo) y notifica a
  /// quien esté escuchando (como [PerfilScreen]).
  Future<void> refreshProfile() async {
    await _loadProfile();
    notifyListeners();
  }

  Future<void> logout() async {
    await _clear(preserveBiometric: _biometricEnabled);
    _setStatus(AuthStatus.unauthenticated);
  }

  Future<void> _loadProfile() async {
    final data = await _api.get('/profile/mi-perfil');
    if (data is Map<String, dynamic>) {
      _profile = Profile.fromJson(data);
    }
  }

  Future<void> _clear({bool preserveBiometric = false}) async {
    await _storage.delete(_tokenKey);
    if (!preserveBiometric) {
      await _storage.delete(_refreshTokenKey);
      await _storage.delete(_biometricEnabledKey);
      _biometricEnabled = false;
    }
    _api.authToken = null;
    _profile = null;
  }

  void _setStatus(AuthStatus status) {
    _status = status;
    notifyListeners();
  }

  /// Se llama cuando cualquier llamada autenticada recibe un 401 en medio de
  /// la sesión (token expirado): cierra sesión y vuelve a la pantalla de
  /// acceso en vez de dejar al usuario viendo un error suelto.
  void _manejarSesionExpirada() {
    if (_status != AuthStatus.authenticated) return;
    _setStatus(AuthStatus.unauthenticated);
    _clear(preserveBiometric: _biometricEnabled);
  }

  @override
  void dispose() {
    _api.dispose();
    super.dispose();
  }
}
