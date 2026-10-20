import 'package:url_launcher/url_launcher.dart';

import 'api_service.dart';

class PagoCheckoutService {
  PagoCheckoutService._();

  static Uri crearUrlCheckout({
    required String publicKey,
    required String currency,
    required int amountInCents,
    required String reference,
    required String integrity,
  }) {
    return Uri.https('checkout.wompi.co', '/p/', {
      'public-key': publicKey,
      'currency': currency,
      'amount-in-cents': amountInCents.toString(),
      'reference': reference,
      'signature:integrity': integrity,
    });
  }

  static Future<void> procesar({
    required ApiService api,
    required String facturaId,
    required String metodo,
    String? referencia,
  }) async {
    if (metodo != 'wompi') {
      await api.post(
        '/pagos',
        body: {
          'factura_id': facturaId,
          'metodo': metodo,
          'referencia': ?referencia,
        },
      );
      return;
    }

    final config = await api.get('/wompi/config');
    if (config is! Map ||
        config['publicKey'] is! String ||
        (config['publicKey'] as String).isEmpty) {
      throw ApiException('El pago en línea no está disponible por el momento.');
    }

    final respuesta = await api.post(
      '/pagos',
      body: {'factura_id': facturaId, 'metodo': 'wompi'},
    );
    if (respuesta is! Map || respuesta['wompi'] is! Map) {
      throw ApiException('No se pudo preparar el pago con Wompi.');
    }

    final pago = respuesta['wompi'] as Map;
    final firma = pago['signature'];
    final integrity = firma is Map ? firma['integrity'] : null;
    final amountInCents = pago['amountInCents'];
    if (pago['reference'] is! String ||
        pago['currency'] is! String ||
        amountInCents is! num ||
        integrity is! String ||
        integrity.isEmpty) {
      throw ApiException('La respuesta de Wompi está incompleta.');
    }

    final url = crearUrlCheckout(
      publicKey: config['publicKey'] as String,
      currency: pago['currency'] as String,
      amountInCents: amountInCents.toInt(),
      reference: pago['reference'] as String,
      integrity: integrity,
    );

    try {
      final abierto = await launchUrl(
        url,
        mode: LaunchMode.externalApplication,
      );
      if (!abierto) {
        throw ApiException('No fue posible abrir el checkout de Wompi.');
      }
    } on ApiException {
      rethrow;
    } catch (_) {
      throw ApiException('No fue posible abrir el checkout de Wompi.');
    }
  }
}
