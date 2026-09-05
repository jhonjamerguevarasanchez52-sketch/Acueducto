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
