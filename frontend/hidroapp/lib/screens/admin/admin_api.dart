import '../../services/api_service.dart';
<<<<<<< Updated upstream
/// Operaciones administrativas de pagos sobre el backend REST.
///
/// Reutiliza el ApiService de la sesión del administrador para conservar su
/// token de autenticación.

/// Operaciones administrativas relacionadas con pagos.
/// Usa el cliente autenticado para conservar el token y manejar expiraciones.

=======

/// Cliente de las rutas de administrador. Envuelve el ApiService que ya usa
/// el resto de la app (mismo token y manejo de errores).
>>>>>>> Stashed changes
class AdminApi {
  AdminApi(this._api);

  final ApiService _api;

<<<<<<< Updated upstream
  Future<List<dynamic>> pagosSinConfirmar() async {

    final respuesta = await _api.get('/pagos/todos?confirmado=false');
    if (respuesta is List) return respuesta;
    throw ApiException('El servidor devolvió una lista de pagos inválida.');
  }

  Future<void> confirmarPago(String pagoId) async {
    if (pagoId.trim().isEmpty) {
      throw ArgumentError.value(pagoId, 'pagoId', 'No puede estar vacío.');
    }
    await _api.put('/pagos/${Uri.encodeComponent(pagoId)}/confirmar');

    final data = await _api.get('/pagos/todos?confirmado=false');
    if (data is! List) {
      throw ApiException('El servidor devolvió una lista de pagos inválida.');
    }
    return data;
  }

  Future<void> confirmarPago(String id) async {
    await _api.put('/pagos/$id/confirmar');

  }
}
=======
  // AJUSTAR si en pagoRoutes.js las rutas se llaman distinto.
  static const _rutaPagosSinConfirmar = '/pagos/sin-confirmar';
  static String _rutaConfirmar(String id) => '/pagos/$id/confirmar';

  /// Acepta tanto una lista directa como {pagos: [...]}, {data: [...]} o
  /// {items: [...]}, según cómo responda el backend.
  List<dynamic> _lista(dynamic data) {
    if (data is List) return data;
    if (data is Map) {
      for (final clave in const ['pagos', 'data', 'items']) {
        final valor = data[clave];
        if (valor is List) return valor;
      }
    }
    return const [];
  }

  Future<List<dynamic>> pagosSinConfirmar() async {
    final data = await _api.get(_rutaPagosSinConfirmar);
    return _lista(data);
  }

  Future<void> confirmarPago(String id) async {
    await _api.put(_rutaConfirmar(id), body: <String, dynamic>{});
  }
}
>>>>>>> Stashed changes
