import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../models/profile.dart';
import '../services/api_service.dart';

enum AuthStatus { unknown, authenticated, unauthenticated }

/// Maneja la sesión del usuario: token de Supabase, perfil y llamadas de auth.
class AuthProvider extends ChangeNotifier {
  AuthProvider({ApiService? api, FlutterSecureStorage? storage})
      : _api = api ?? ApiService(),
        _storage = storage ?? const FlutterSecureStorage();

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
    } catch (_) {
      await _clear();
      _setStatus(AuthStatus.unauthenticated);
    }
  }

  Future<void> login(String correo, String password) async {
    final data = await _api.post('/auth/login', body: {
      'correo': correo.trim(),
      'password': password,
    });

    String? token;
    if (data is Map && data['session'] is Map) {
      token = (data['session'] as Map)['access_token'] as String?;
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
}
