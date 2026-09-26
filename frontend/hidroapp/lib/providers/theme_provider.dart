import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Recuerda si el usuario prefiere el tema claro, oscuro o el del sistema, y
/// lo persiste para que no haya que elegirlo de nuevo en cada sesión.
class ThemeProvider extends ChangeNotifier {
  ThemeProvider({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage() {
    _cargar();
  }

  static const _key = 'theme_mode';

  final FlutterSecureStorage _storage;
  ThemeMode _modo = ThemeMode.system;

  ThemeMode get modo => _modo;

  Future<void> _cargar() async {
    final guardado = await _storage.read(key: _key);
    final modo = _desdeTexto(guardado);
    if (modo != null && modo != _modo) {
      _modo = modo;
      notifyListeners();
    }
  }

  Future<void> cambiar(ThemeMode modo) async {
    if (modo == _modo) return;
    _modo = modo;
    notifyListeners();
    await _storage.write(key: _key, value: modo.name);
  }

  ThemeMode? _desdeTexto(String? texto) {
    switch (texto) {
      case 'light':
        return ThemeMode.light;
      case 'dark':
        return ThemeMode.dark;
      case 'system':
        return ThemeMode.system;
      default:
        return null;
    }
  }
}
