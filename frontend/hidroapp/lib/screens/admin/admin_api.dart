import '../../services/api_service.dart';

/// Operaciones administrativas relacionadas con pagos.
/// Usa el cliente autenticado para conservar el token y manejar expiraciones.
class AdminApi {
  AdminApi(this._api);

  final ApiService _api;

  Future<List<dynamic>> pagosSinConfirmar() async {
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
