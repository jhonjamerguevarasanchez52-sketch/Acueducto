import '../../services/api_service.dart';

/// Cliente de las rutas administrativas de pagos.
class AdminApi {
  AdminApi(this._api);

  final ApiService _api;

  /// `true` si el pago es un recibo físico que espera la revisión del
  /// administrador. Los pagos de Wompi nunca se confirman a mano: los
  /// confirma el aviso firmado de Wompi cuando el dinero llega.
  static bool esReciboPorRevisar(Map<String, dynamic> pago) =>
      pago['confirmado'] != true &&
      pago['metodo'] != 'wompi' &&
      (pago['estado_wompi'] == null ||
          pago['estado_wompi'].toString().trim().isEmpty);

  /// Recibos físicos pendientes de revisión.
  Future<List<Map<String, dynamic>>> pagosSinConfirmar() async {
    final data = await _api.get('/pagos/todos?confirmado=false');
    if (data is! List) {
      throw ApiException('El servidor devolvio una lista de pagos invalida.');
    }
    return data
        .whereType<Map>()
        .map((p) => Map<String, dynamic>.from(p))
        .where(esReciboPorRevisar)
        .toList();
  }

  Future<void> confirmarPago(String id) async {
    if (id.trim().isEmpty) {
      throw ArgumentError.value(id, 'id', 'No puede estar vacio.');
    }
    await _api.put('/pagos/${Uri.encodeComponent(id)}/confirmar');
  }
}
