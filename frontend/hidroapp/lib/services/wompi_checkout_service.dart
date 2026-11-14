import 'package:url_launcher/url_launcher.dart';
import 'package:flutter/material.dart';

import 'api_service.dart';
import '../utils/formato.dart';

/// Registra el pago en el servidor y abre el checkout hospedado de Wompi.
class WompiCheckoutService {
  /// URL del Web Checkout oficial de Wompi con los datos que firmó el backend.
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

  /// Muestra el desglose, y solo si el usuario acepta registra el pago y abre
  /// el checkout. Devuelve `false` si canceló.
  ///
  /// - [cotizacion]: desglose ya conocido (el del plan elegido). Si no se da,
  ///   se pide al servidor con el valor actual de la factura.
  /// - [antesDeRegistrar]: se ejecuta tras aceptar y antes de crear el pago;
  ///   ahí se aplica el plan elegido, para que cancelar no cambie la factura.
  static Future<bool> pagar(
    BuildContext context,
    ApiService api,
    String facturaId, {
    Map<String, dynamic>? cotizacion,
    Future<void> Function()? antesDeRegistrar,
  }) async {
    final Map<String, dynamic> desglose;
    if (cotizacion != null) {
      desglose = cotizacion;
    } else {
      final cotizacionRespuesta = await api.get('/pagos/cotizacion-wompi/$facturaId');
      if (cotizacionRespuesta is! Map) {
        throw ApiException('El servidor no devolvió el desglose del pago.');
      }
      desglose = Map<String, dynamic>.from(cotizacionRespuesta);
    }
    if (!context.mounted) return false;
    String formato(Object? valor) => Formato.pesos(num.tryParse('$valor') ?? 0);
    final aceptar = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        scrollable: true,
        title: const Text('Detalle del pago en línea'),
        content: Text(
          'Servicio del acueducto: ${formato(desglose['valorServicio'])}\n'
          'Cargo estimado de Wompi: ${formato(desglose['cargoWompi'])}\n\n'
          'Total que se cobrará: ${formato(desglose['totalCobrar'])}\n\n'
          'El cargo de Wompi cubre la tarifa de la transacción. El valor del servicio que recibe el acueducto se mantiene igual.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancelar')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Continuar')),
        ],
      ),
    );
    if (aceptar != true || !context.mounted) return false;

    if (antesDeRegistrar != null) await antesDeRegistrar();

    final respuesta = await api.post(
      '/pagos',
      body: {'factura_id': facturaId, 'metodo': 'wompi'},
    );
    if (respuesta is! Map || respuesta['wompi'] is! Map) {
      throw ApiException('El servidor no devolvió los datos del checkout.');
    }

    final datos = Map<String, dynamic>.from(respuesta['wompi'] as Map);
    final publicKey = '${datos['publicKey'] ?? ''}'.trim();
    final currency = '${datos['currency'] ?? ''}'.trim();
    final reference = '${datos['reference'] ?? ''}'.trim();
    final integrity = '${datos['signature'] ?? ''}'.trim();
    final amountInCents = datos['amountInCents'];
    if (publicKey.isEmpty ||
        currency.isEmpty ||
        reference.isEmpty ||
        integrity.isEmpty ||
        amountInCents is! num ||
        amountInCents <= 0) {
      throw ApiException(
        'El servidor no tiene completa la configuración de Wompi.',
      );
    }

    final checkout = crearUrlCheckout(
      publicKey: publicKey,
      currency: currency,
      amountInCents: amountInCents.toInt(),
      reference: reference,
      integrity: integrity,
    );
    try {
      if (!await launchUrl(checkout, mode: LaunchMode.externalApplication)) {
        throw ApiException('No se pudo abrir el checkout de Wompi.');
      }
    } on ApiException {
      rethrow;
    } catch (_) {
      throw ApiException('No se pudo abrir el checkout de Wompi.');
    }
    return true;
  }
}
