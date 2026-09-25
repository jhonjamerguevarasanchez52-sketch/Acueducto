import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../models/profile.dart';
import '../services/api_service.dart';

enum AuthStatus { unknown, authenticated, unauthenticated }

/// Maneja la sesión del usuario: token de Supabase, perfil y llamadas de auth.
class AuthProvider extends ChangeNotifier {
  AuthProvider({ApiService? api, FlutterSecureStorage? storage})
      : _api = api ?? ApiService(),
        _storage = storage ?? const FlutterSecureStorage() {
    _api.onUnauthorized = _manejarSesionExpirada;
  }

  final ApiService _api;
  final FlutterSecureStorage _storage;

  static const _tokenKey = 'access_token';

  AuthStatus _status = AuthStatus.unknown;
  Profile? _profile;

  AuthStatus get status => _status;
  Profile? get profile => _profile;
  ApiService get api => _api;

  /// `true` cuando la cuenta tiene pendiente cambiar una contraseña temporal
  /// (generada por un administrador al crearla). Mientras sea `true`,
  /// [AuthGate] debe mostrar la pantalla de cambio obligatorio en vez de la
  /// app normal.
  bool get debeCambiarPassword => _profile?.debeCambiarPassword ?? false;

  /// Se llama al arrancar la app: intenta restaurar la sesión guardada.
  Future<void> bootstrap() async {
    final token = await _storage.read(key: _tokenKey);
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
        await _clear();
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
      throw ApiException('La respuesta del servidor no incluyó una sesión válida.');
    }

    await _storage.write(key: _tokenKey, value: token);
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

  /// Cambia la contraseña de la cuenta ya autenticada. Se usa para el cambio
  /// obligatorio tras el primer login con una contraseña temporal, pero sirve
  /// igual para un cambio voluntario. Al terminar, refresca el perfil para
  /// que [debeCambiarPassword] pase a `false` y [AuthGate] deje entrar a la app.
  Future<void> cambiarPassword(String passwordActual, String passwordNueva) async {
    await _api.post('/auth/cambiar-password', body: {
      'passwordActual': passwordActual,
      'passwordNueva': passwordNueva,
    });
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
    await _clear();
    _setStatus(AuthStatus.unauthenticated);
  }

  Future<void> _loadProfile() async {
    final data = await _api.get('/profile/mi-perfil');
    if (data is Map<String, dynamic>) {
      _profile = Profile.fromJson(data);
    }
  }

  Future<void> _clear() async {
    await _storage.delete(key: _tokenKey);
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
    _clear();
  }

  @override
  void dispose() {
    _api.dispose();
    super.dispose();
  }
}
