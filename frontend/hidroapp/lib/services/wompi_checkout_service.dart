import 'package:url_launcher/url_launcher.dart';

import 'api_service.dart';

/// Registra el pago en el servidor y abre el checkout hospedado de Wompi.
class WompiCheckoutService {
  static Future<void> pagar(ApiService api, String facturaId) async {
    final respuesta = await api.post(
      '/pagos',
      body: {'factura_id': facturaId, 'metodo': 'wompi'},
    );
    if (respuesta is! Map || respuesta['wompi'] is! Map) {
      throw ApiException('El servidor no devolvió los datos del checkout.');
    }

    final datos = Map<String, dynamic>.from(respuesta['wompi'] as Map);
    final params = <String, String>{
      'public-key': '${datos['publicKey'] ?? ''}',
      'currency': '${datos['currency'] ?? ''}',
      'amount-in-cents': '${datos['amountInCents'] ?? ''}',
      'reference': '${datos['reference'] ?? ''}',
      'signature:integrity': '${datos['signature'] ?? ''}',
    };
    if (params.values.any((v) => v.trim().isEmpty)) {
      throw ApiException(
        'El servidor no tiene completa la configuración de Wompi.',
      );
    }

    final checkout = Uri.https('checkout.wompi.co', '/p/', params);
    try {
      if (!await launchUrl(checkout, mode: LaunchMode.externalApplication)) {
        throw ApiException('No se pudo abrir el checkout de Wompi.');
      }
    } on ApiException {
      rethrow;
    } catch (_) {
      throw ApiException('No se pudo abrir el checkout de Wompi.');
    }
  }
}
