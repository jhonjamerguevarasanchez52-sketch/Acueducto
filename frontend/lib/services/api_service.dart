import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart' show debugPrint, kDebugMode;
import 'package:http/http.dart' as http;

import '../config/api_config.dart';

/// Error de API con el mensaje que devuelve el backend (`{ "error": "..." }`).
class ApiException implements Exception {
  ApiException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

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

  Future<dynamic> put(String path, {Object? body}) => _send(() => _client
      .put(_uri(path), headers: _headers, body: jsonEncode(body ?? {}))
      .timeout(_timeout));

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

    if (res.statusCode >= 200 && res.statusCode < 300) {
      return data;
    }

    final msg = data is Map && data['error'] is String
        ? data['error'] as String
        : 'Error ${res.statusCode}';

    if (res.statusCode == 401) {
      onUnauthorized?.call();
    }

    throw ApiException(msg, statusCode: res.statusCode);
  }

  void dispose() => _client.close();
}
