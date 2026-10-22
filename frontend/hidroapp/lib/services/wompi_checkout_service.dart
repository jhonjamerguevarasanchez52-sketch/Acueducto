import 'package:url_launcher/url_launcher.dart';
import 'package:flutter/material.dart';

import 'api_service.dart';
import '../utils/formato.dart';

/// Registra el pago en el servidor y abre el checkout hospedado de Wompi.
class WompiCheckoutService {
  static Future<bool> pagar(BuildContext context, ApiService api, String facturaId) async {
    final cotizacionRespuesta = await api.get('/pagos/cotizacion-wompi/$facturaId');
    if (cotizacionRespuesta is! Map) {
      throw ApiException('El servidor no devolvió el desglose del pago.');
    }
    if (!context.mounted) return false;
    final cotizacion = Map<String, dynamic>.from(cotizacionRespuesta);
    String formato(Object? valor) => Formato.pesos(num.tryParse('$valor') ?? 0);
    final aceptar = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Detalle del pago en línea'),
        content: Text(
          'Servicio del acueducto: ${formato(cotizacion['valorServicio'])}\n'
          'Cargo estimado de Wompi: ${formato(cotizacion['cargoWompi'])}\n\n'
          'Total que se cobrará: ${formato(cotizacion['totalCobrar'])}\n\n'
          'El cargo de Wompi cubre la tarifa de la transacción. El valor del servicio que recibe el acueducto se mantiene igual.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancelar')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Continuar')),
        ],
      ),
    );
    if (aceptar != true || !context.mounted) return false;

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
    return true;
  }
}
