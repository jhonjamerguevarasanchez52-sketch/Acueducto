import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart' show debugPrint, kDebugMode;
import 'package:http/http.dart' as http;

import '../config/api_config.dart';

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

/// Cliente HTTP delgado sobre el backend REST.
///
/// Inyecta el token `Authorization: Bearer <token>` cuando está disponible y
/// normaliza los errores a [ApiException].
class ApiService {
  ApiService({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

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

  static const Duration _timeout = Duration(seconds: 20);

  Uri _uri(String path) => Uri.parse('${ApiConfig.baseUrl}$path');

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (authToken != null) 'Authorization': 'Bearer $authToken',
      };

  Future<dynamic> get(String path) => _send(path, () => _client
      .get(_uri(path), headers: _headers)
      .timeout(_timeout));

  Future<dynamic> post(String path, {Object? body}) => _send(path, () => _client
      .post(_uri(path), headers: _headers, body: jsonEncode(body ?? {}))
      .timeout(_timeout));

  Future<dynamic> postBytes(
    String path, {
    required List<int> bytes,
    required String contentType,
  }) =>
      _send(
        path,
        () => _client
            .post(
              _uri(path),
              headers: {
                'Content-Type': contentType,
                if (authToken != null) 'Authorization': 'Bearer $authToken',
              },
              body: bytes,
            )
            .timeout(_timeout),
      );

  Future<dynamic> put(String path, {Object? body}) => _send(path, () => _client
      .put(_uri(path), headers: _headers, body: jsonEncode(body ?? {}))
      .timeout(_timeout));

  Future<dynamic> _send(
    String path,
    Future<http.Response> Function() request,
  ) async {
    final tokenUsado = authToken;
    var res = await _ejecutar(request);

    // El access token de Supabase vence (≈1 h). Antes de dar la sesión por
    // perdida pedimos uno nuevo con el refresh token y repetimos la petición
    // una sola vez. Si otra petición ya lo renovó, basta con reintentar.
    if (res.statusCode == 401 &&
        tokenUsado != null &&
        path != _rutaRenovarSesion) {
      final renovado = authToken != tokenUsado ||
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
      throw ApiException('El servidor no respondió a tiempo. Verifica tu conexión.');
    } catch (e, st) {
      // No filtramos el error real al usuario (podría ser un detalle técnico
      // sin sentido para él), pero sí lo dejamos en el log para poder
      // diagnosticar problemas reales (DNS, certificado, etc.) en vez de que
      // todo se vea igual que "sin internet".
      if (kDebugMode) debugPrint('[ApiService] fallo de red: $e\n$st');
      throw ApiException('No se pudo conectar con el servidor.');
    }
  }

  void dispose() => _client.close();
}
