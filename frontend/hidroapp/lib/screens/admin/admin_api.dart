import '../../services/api_service.dart';

/// Cliente de las rutas administrativas de pagos.
class AdminApi {
  AdminApi(this._api);

  final ApiService _api;

  Future<List<dynamic>> pagosSinConfirmar() async {
    final data = await _api.get('/pagos/todos?confirmado=false');
    if (data is List) return data;
    throw ApiException('El servidor devolvio una lista de pagos invalida.');
  }

  Future<void> confirmarPago(String id) async {
    if (id.trim().isEmpty) {
      throw ArgumentError.value(id, 'id', 'No puede estar vacio.');
    }
    await _api.put('/pagos/${Uri.encodeComponent(id)}/confirmar');
  }
}
