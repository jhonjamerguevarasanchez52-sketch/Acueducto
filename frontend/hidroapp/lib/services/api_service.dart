import 'dart:async';
import 'dart:convert';
import 'dart:io' show HandshakeException, SocketException, TlsException;

import 'package:flutter/foundation.dart'
    show debugPrint, kDebugMode, visibleForTesting;
import 'package:http/http.dart' as http;

import '../config/api_config.dart';
import '../utils/lenguaje_ofensivo.dart';

/// Error de API con el mensaje y los datos que devuelve el backend.
class ApiException implements Exception {
  ApiException(this.message, {this.statusCode, this.data});

  final String message;
  final int? statusCode;
  final dynamic data;

  bool get requiereVerificacion =>
      data is Map && (data as Map)['requiereVerificacion'] == true;

  @override
  String toString() => message;
}

class _TiempoAgotado extends ApiException {
  _TiempoAgotado()
    : super(
        'El servidor no respondió a tiempo. Verifica tu conexión e intenta de nuevo.',
      );
}

/// Cliente HTTP del backend REST.
class ApiService {
  ApiService({http.Client? client, this.tiempoMaximo = tiempoMaximoPorDefecto})
    : _client = client ?? http.Client();

  final http.Client _client;

  /// Render puede tardar en responder cuando el servicio acaba de despertar.
  static const Duration tiempoMaximoPorDefecto = Duration(seconds: 45);

  final Duration tiempoMaximo;
  String? authToken;

  /// Renueva la sesión si una petición autenticada recibe 401.
  Future<bool> Function()? onUnauthorized;

  static const _rutaRenovarSesion = '/auth/renovar-sesion';

  Uri _uri(String path) => Uri.parse('${ApiConfig.baseUrl}$path');

  Map<String, String> get _headers => {
    'Content-Type': 'application/json',
    if (authToken != null) 'Authorization': 'Bearer $authToken',
  };

  Future<dynamic> get(String path) => _send(
    path,
    () => _client.get(_uri(path), headers: _headers).timeout(tiempoMaximo),
    reintentarFalloDeRed: true,
  );

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

  Future<dynamic> delete(String path, {Object? body}) => _send(
    path,
    () => _client
        .delete(
          _uri(path),
          headers: _headers,
          body: body == null ? null : jsonEncode(body),
        )
        .timeout(tiempoMaximo),
  );

  static Future<dynamic>? _rechazarOfensivo(Object? body) =>
      cuerpoConLenguajeOfensivo(body)
      ? Future.error(ApiException(mensajeLenguajeOfensivo, statusCode: 400))
      : null;

  /// Renueva el refresh token sin pasar por [_send] para evitar un bucle 401.
  Future<dynamic> renewSession(String refreshToken) async {
    final response = await _ejecutar(
      () => _client
          .post(
            _uri(_rutaRenovarSesion),
            headers: const {'Content-Type': 'application/json'},
            body: jsonEncode({'refreshToken': refreshToken}),
          )
          .timeout(tiempoMaximo),
    );
    final data = _decodificar(response);
    if (response.statusCode >= 200 && response.statusCode < 300) return data;
    final message = data is Map && data['error'] is String
        ? data['error'] as String
        : 'No se pudo renovar la sesión.';
    throw ApiException(message, statusCode: response.statusCode, data: data);
  }

  static dynamic _decodificar(http.Response response) {
    if (response.body.isEmpty) return null;
    try {
      return jsonDecode(response.body);
    } catch (_) {
      return response.body;
    }
  }

  Future<dynamic> _send(
    String path,
    Future<http.Response> Function() request, {
    bool reintentarFalloDeRed = false,
  }) async {
    http.Response response;
    try {
      response = await _ejecutar(request);
    } on ApiException catch (error) {
      if (!reintentarFalloDeRed || error is _TiempoAgotado) rethrow;
      response = await _ejecutar(request);
    }

    if (response.statusCode == 401 &&
        authToken != null &&
        path != _rutaRenovarSesion &&
        onUnauthorized != null) {
      var renewed = false;
      try {
        renewed = await onUnauthorized!.call();
      } catch (error) {
        if (kDebugMode) {
          debugPrint('[ApiService] no se pudo renovar la sesión: $error');
        }
      }
      if (renewed) response = await _ejecutar(request);
    }

    final data = _decodificar(response);
    if (response.statusCode >= 200 && response.statusCode < 300) return data;

    final message = data is Map && data['error'] is String
        ? data['error'] as String
        : 'Error ${response.statusCode}';
    throw ApiException(message, statusCode: response.statusCode, data: data);
  }

  Future<http.Response> _ejecutar(
    Future<http.Response> Function() request,
  ) async {
    try {
      return await request();
    } on TimeoutException catch (error) {
      if (kDebugMode) debugPrint('[ApiService] timeout: $error');
      throw _TiempoAgotado();
    } catch (error, stackTrace) {
      if (kDebugMode) {
        debugPrint('[ApiService] fallo de red: $error\n$stackTrace');
      }
      throw ApiException(mensajeFalloDeRed(error));
    }
  }

  @visibleForTesting
  static String mensajeFalloDeRed(Object error) {
    if (error is HandshakeException || error is TlsException) {
      return 'No se pudo establecer una conexión segura con el servidor. '
          'Revisa que la fecha y la hora del teléfono estén en automático. '
          '(código RED-TLS)';
    }
    final text = error.toString();
    if (text.contains('Failed host lookup') ||
        text.contains('No address associated with hostname')) {
      return 'No hay internet o no se encontró el servidor. Revisa tus datos '
          'o el Wi-Fi y vuelve a intentar. (código RED-DNS)';
    }
    if (error is SocketException) {
      return 'No se pudo conectar con el servidor. Revisa tu conexión y que '
          'la app tenga permiso de usar datos. (código RED-SOCKET)';
    }
    return 'Se interrumpió la conexión con el servidor. Intenta de nuevo. '
        '(código RED-CONEXION)';
  }

  void dispose() => _client.close();
}
