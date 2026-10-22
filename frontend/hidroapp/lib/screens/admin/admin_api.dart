import '../../services/api_service.dart';
/// Operaciones administrativas de pagos sobre el backend REST.
///
/// Reutiliza el ApiService de la sesión del administrador para conservar su
/// token de autenticación.

/// Operaciones administrativas relacionadas con pagos.
/// Usa el cliente autenticado para conservar el token y manejar expiraciones.

class AdminApi {
  AdminApi(this._api);

  final ApiService _api;

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
