import 'dart:async';
import 'dart:convert';
import 'dart:io' show HandshakeException, SocketException, TlsException;

import 'package:flutter/foundation.dart'
    show debugPrint, kDebugMode, visibleForTesting;
import 'package:http/http.dart' as http;

import '../config/api_config.dart';
import '../utils/lenguaje_ofensivo.dart';

/// Error de API con el mensaje que devuelve el backend (`{ "error": "..." }`).
class ApiException implements Exception {
  ApiException(this.message, {this.statusCode, this.data});

  final String message;
  final int? statusCode;

  /// Cuerpo de la respuesta ya decodificado (si lo hubo). Permite leer flags
  /// extra que manda el backend junto al error, como `requiereVerificacion`.
  final dynamic data;

  /// `true` cuando el backend rechazó el login porque la cuenta todavía no ha
  /// confirmado su código de verificación.
  bool get requiereVerificacion =>
      data is Map && (data as Map)['requiereVerificacion'] == true;

  @override
  String toString() => message;
}

/// La petición superó el tiempo máximo de espera. Se distingue de un fallo de
/// conexión porque no conviene reintentarla automáticamente.
class _TiempoAgotado extends ApiException {
  _TiempoAgotado()
    : super(
        'El servidor no respondió a tiempo. Verifica tu conexión e intenta de nuevo.',
      );
}

/// Cliente HTTP delgado sobre el backend REST.
///
/// Inyecta el token `Authorization: Bearer <token>` cuando está disponible y
/// normaliza los errores a [ApiException].
class ApiService {
  ApiService({http.Client? client, this.tiempoMaximo = tiempoMaximoPorDefecto})
    : _client = client ?? http.Client();

  final http.Client _client;

  /// Render (plan gratuito) tarda 30–60 s en despertar el servidor dormido.
  static const Duration tiempoMaximoPorDefecto = Duration(seconds: 45);

  /// Tiempo máximo de espera por petición (configurable para las pruebas).
  final Duration tiempoMaximo;

  /// Token de acceso de Supabase. Lo setea el [AuthProvider] al iniciar sesión.
  String? authToken;

  /// Se invoca cuando una respuesta llega con 401 (token expirado/ inválido)
  /// para que quien mantiene la sesión (el [AuthProvider]) pueda reaccionar.
  void Function()? onUnauthorized;

  /// Se invoca cuando una petición autenticada recibe 401, antes de dar la
  /// sesión por perdida: debe renovar [authToken] con el refresh token
  /// guardado y devolver `true` si lo logró, para reintentar la petición.
  Future<bool> Function()? onRenovarSesion;

  static const _rutaRenovarSesion = '/auth/renovar-sesion';

  Uri _uri(String path) => Uri.parse('${ApiConfig.baseUrl}$path');

  Map<String, String> get _headers => {
    'Content-Type': 'application/json',
    if (authToken != null) 'Authorization': 'Bearer $authToken',
  };

  /// Los GET no cambian nada en el servidor, así que se reintentan una vez
  /// ante un fallo de conexión (típico mientras Render despierta). Tras un
  /// timeout NO se reintenta: el usuario ya esperó el máximo y volver a
  /// esperar lo mismo duplicaría la espera sin avisarle.
  Future<dynamic> get(String path) => _send(
    path,
    () => _client.get(_uri(path), headers: _headers).timeout(tiempoMaximo),
    reintentarFalloDeRed: true,
  );

  /// Ningún texto con groserías o lenguaje ofensivo sale de la app: se avisa
  /// al instante sin esperar al servidor (que tiene la misma regla).
  static Future<dynamic>? _rechazarOfensivo(Object? body) =>
      cuerpoConLenguajeOfensivo(body)
          ? Future.error(ApiException(mensajeLenguajeOfensivo, statusCode: 400))
          : null;

  Future<dynamic> post(String path, {Object? body}) =>
      _rechazarOfensivo(body) ??
      _send(
        path,
        () => _client
            .post(_uri(path), headers: _headers, body: jsonEncode(body ?? {}))
            .timeout(tiempoMaximo),
      );

  Future<dynamic> postBytes(
    String path, {
    required List<int> bytes,
    required String contentType,
    Map<String, String> headers = const {},
  }) => _send(
    path,
    () => _client
        .post(
          _uri(path),
          headers: {
            ...headers,
            'Content-Type': contentType,
            if (authToken != null) 'Authorization': 'Bearer $authToken',
          },
          body: bytes,
        )
        .timeout(tiempoMaximo),
  );

  Future<dynamic> put(String path, {Object? body}) =>
      _rechazarOfensivo(body) ??
      _send(
        path,
        () => _client
            .put(_uri(path), headers: _headers, body: jsonEncode(body ?? {}))
            .timeout(tiempoMaximo),
      );

  Future<dynamic> delete(String path) => _send(
    path,
    () => _client.delete(_uri(path), headers: _headers).timeout(tiempoMaximo),
  );

  Future<dynamic> _send(
    String path,
    Future<http.Response> Function() request, {
    bool reintentarFalloDeRed = false,
  }) async {
    final tokenUsado = authToken;
    http.Response res;
    try {
      res = await _ejecutar(request);
    } on ApiException catch (e) {
      if (!reintentarFalloDeRed || e is _TiempoAgotado) rethrow;
      res = await _ejecutar(request);
    }

    // El access token de Supabase vence (≈1 h). Antes de dar la sesión por
    // perdida pedimos uno nuevo con el refresh token y repetimos la petición
    // una sola vez. Si otra petición ya lo renovó, basta con reintentar.
    if (res.statusCode == 401 &&
        tokenUsado != null &&
        path != _rutaRenovarSesion) {
      final renovado =
          authToken != tokenUsado ||
          (onRenovarSesion != null && await onRenovarSesion!());
      if (renovado && authToken != null) res = await _ejecutar(request);
    }

    dynamic data;
    if (res.body.isNotEmpty) {
      try {
        data = jsonDecode(res.body);
      } catch (_) {
        data = res.body;
      }
    }

    if (res.statusCode >= 200 && res.statusCode < 300) {
      return data;
    }

    final msg = data is Map && data['error'] is String
        ? data['error'] as String
        : 'Error ${res.statusCode}';

    if (res.statusCode == 401) {
      onUnauthorized?.call();
    }

    throw ApiException(msg, statusCode: res.statusCode, data: data);
  }

  Future<http.Response> _ejecutar(
    Future<http.Response> Function() request,
  ) async {
    try {
      return await request();
    } on TimeoutException catch (e) {
      if (kDebugMode) debugPrint('[ApiService] timeout: $e');
      throw _TiempoAgotado();
    } catch (e, st) {
      // No filtramos el error real al usuario (podría ser un detalle técnico
      // sin sentido para él), pero sí lo dejamos en el log para poder
      // diagnosticar problemas reales (DNS, certificado, etc.) en vez de que
      // todo se vea igual que "sin internet".
      if (kDebugMode) debugPrint('[ApiService] fallo de red: $e\n$st');
      throw ApiException(mensajeFalloDeRed(e));
    }
  }

  /// Traduce el fallo de red a un mensaje que el usuario pueda resolver, con
  /// un código corto para que nos diga qué le salió sin ver el log.
  @visibleForTesting
  static String mensajeFalloDeRed(Object e) {
    if (e is HandshakeException || e is TlsException) {
      return 'No se pudo establecer una conexión segura con el servidor. '
          'Revisa que la fecha y la hora del teléfono estén en automático. '
          '(código RED-TLS)';
    }
    final texto = e.toString();
    if (texto.contains('Failed host lookup') ||
        texto.contains('No address associated with hostname')) {
      return 'No hay internet o no se encontró el servidor. Revisa tus datos '
          'o el Wi-Fi y vuelve a intentar. (código RED-DNS)';
    }
    if (e is SocketException) {
      return 'No se pudo conectar con el servidor. Revisa tu conexión y que '
          'la app tenga permiso de usar datos. (código RED-SOCKET)';
    }
    return 'Se interrumpió la conexión con el servidor. Intenta de nuevo. '
        '(código RED-CONEXION)';
  }

  void dispose() => _client.close();
}
