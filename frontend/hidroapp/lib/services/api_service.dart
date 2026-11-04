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

  /// Renews an expired access token and lets this client retry once.
  Future<bool> Function()? onUnauthorized;

  static const Duration _timeout = Duration(seconds: 20);

  Uri _uri(String path) => Uri.parse('${ApiConfig.baseUrl}$path');

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (authToken != null) 'Authorization': 'Bearer $authToken',
      };

  Future<dynamic> get(String path) => _send(() => _client
      .get(_uri(path), headers: _headers)
      .timeout(_timeout));

  Future<dynamic> post(String path, {Object? body}) => _send(() => _client
      .post(_uri(path), headers: _headers, body: jsonEncode(body ?? {}))
      .timeout(_timeout));

  Future<dynamic> postBytes(
    String path, {
    required List<int> bytes,
    required String contentType,
  }) =>
      _send(
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

  Future<dynamic> put(String path, {Object? body}) => _send(() => _client
      .put(_uri(path), headers: _headers, body: jsonEncode(body ?? {}))
      .timeout(_timeout));

  /// Renews tokens through the public auth endpoint without re-entering
  /// [_send], which prevents a rejected refresh from creating a 401 loop.
  Future<dynamic> renewSession(String refreshToken) async {
    final response = await _client
        .post(
          _uri('/auth/renovar-sesion'),
          headers: const {'Content-Type': 'application/json'},
          body: jsonEncode({'refreshToken': refreshToken}),
        )
        .timeout(_timeout);
    dynamic data;
    if (response.body.isNotEmpty) {
      try {
        data = jsonDecode(response.body);
      } catch (_) {
        data = response.body;
      }
    }
    if (response.statusCode >= 200 && response.statusCode < 300) return data;
    final message = data is Map && data['error'] is String
        ? data['error'] as String
        : 'No se pudo renovar la sesión.';
    throw ApiException(message, statusCode: response.statusCode, data: data);
  }

  Future<dynamic> _send(Future<http.Response> Function() request) async {
    http.Response res;
    try {
      res = await request();
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

    dynamic data;
    if (res.body.isNotEmpty) {
      try {
        data = jsonDecode(res.body);
      } catch (_) {
        data = res.body;
      }
    }

    if (res.statusCode == 401 && authToken != null && onUnauthorized != null) {
      var renewed = false;
      try {
        renewed = await onUnauthorized!.call();
      } catch (e) {
        if (kDebugMode) debugPrint('[ApiService] no se pudo renovar la sesión: $e');
      }
      if (renewed) {
        try {
          res = await request();
        } on TimeoutException {
          throw ApiException('El servidor no respondió a tiempo. Verifica tu conexión.');
        } catch (e) {
          if (e is ApiException) rethrow;
          if (kDebugMode) debugPrint('[ApiService] fallo al repetir petición: $e');
          throw ApiException('No se pudo conectar con el servidor.');
        }
        data = null;
        if (res.body.isNotEmpty) {
          try {
            data = jsonDecode(res.body);
          } catch (_) {
            data = res.body;
          }
        }
      }
    }

    if (res.statusCode >= 200 && res.statusCode < 300) {
      return data;
    }

    final msg = data is Map && data['error'] is String
        ? data['error'] as String
        : 'Error ${res.statusCode}';

    throw ApiException(msg, statusCode: res.statusCode, data: data);
  }

  void dispose() => _client.close();
}
