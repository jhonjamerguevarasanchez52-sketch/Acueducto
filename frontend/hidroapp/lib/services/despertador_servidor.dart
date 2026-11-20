import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:http/http.dart' as http;

import '../config/api_config.dart';

/// Despierta el servidor de Render apenas se abre la app.
///
/// En el plan gratuito, Render apaga el servidor tras 15 minutos sin
/// peticiones y tarda cerca de un minuto en volver a arrancar. Si se espera a
/// que el usuario toque "Ingresar", ese minuto lo sufre él. Por eso, al abrir
/// la app (y al volver a ella después de un rato) se hace un GET a `/health`
/// sin esperar la respuesta: mientras se ve la bienvenida y se escribe la
/// contraseña, el servidor ya está arrancando.
///
/// Nunca muestra errores ni bloquea nada: si falla, la app sigue igual.
class DespertadorServidor with WidgetsBindingObserver {
  DespertadorServidor({http.Client? client, DateTime Function()? reloj})
    : _client = client ?? http.Client(),
      _reloj = reloj ?? DateTime.now;

  /// Render duerme el servidor a los 15 minutos; un aviso cada 10 basta para
  /// que siga despierto mientras la app está en uso.
  static const intervalo = Duration(minutes: 10);

  /// Lo que puede tardar Render en arrancar desde cero, con margen.
  static const espera = Duration(seconds: 90);

  final http.Client _client;
  final DateTime Function() _reloj;
  DateTime? _ultimoAviso;
  bool _enCurso = false;

  /// Empieza a escuchar cuándo vuelve la app al frente y despierta el
  /// servidor de una vez.
  void iniciar() {
    WidgetsBinding.instance.addObserver(this);
    unawaited(despertar());
  }

  void detener() => WidgetsBinding.instance.removeObserver(this);

  /// Hace el GET a `/health` si no se hizo en los últimos [intervalo].
  /// Devuelve `true` si envió la petición.
  Future<bool> despertar() async {
    final ahora = _reloj();
    if (_enCurso ||
        (_ultimoAviso != null && ahora.difference(_ultimoAviso!) < intervalo)) {
      return false;
    }
    _enCurso = true;
    _ultimoAviso = ahora;
    try {
      await _client.get(Uri.parse(ApiConfig.healthUrl)).timeout(espera);
    } catch (_) {
      // Sin red o servidor caído: la primera petición real mostrará el error.
    } finally {
      _enCurso = false;
    }
    return true;
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) unawaited(despertar());
  }
}
