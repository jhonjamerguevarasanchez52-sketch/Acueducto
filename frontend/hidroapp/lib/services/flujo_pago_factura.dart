import 'package:flutter/material.dart';

import '../models/factura.dart';
import '../models/pago.dart';
import '../utils/formato.dart';
import '../widgets/core/pagar_sheet.dart';
import '../widgets/facturas/plan_pago_sheet.dart';
import 'api_service.dart';
import 'recibo_pago_service.dart';
import 'wompi_checkout_service.dart';

/// Cómo terminó un intento de pago.
enum ResultadoPago {
  /// El usuario cerró alguna ventana: la factura queda exactamente igual.
  cancelado,

  /// Se registró el pago y se abrió el checkout de Wompi.
  checkoutAbierto,

  /// Se envió la foto del recibo físico; queda pendiente de revisión.
  reciboEnviado,
}

/// Flujo único de "Pagar", compartido por Inicio, Mis facturas y Mis pagos.
///
/// Orden de los pasos:
/// 1. Si la factura admite planes, el usuario elige mensual, semestral o
///    anual. Las cuotas extraordinarias se saltan este paso: se pagan tal
///    como se emitieron.
/// 2. Elige el medio: Wompi o recibo físico.
/// 3. Confirma: acepta el desglose de Wompi o escoge la foto del recibo.
/// 4. Solo entonces se aplica el plan en el servidor y se registra el pago.
///
/// Si cancela en cualquier paso, la factura no cambia. Si el plan quedó
/// aplicado y el registro del pago falla, se intenta devolver la factura a su
/// plan anterior.
class FlujoPagoFactura {
  FlujoPagoFactura._();

  /// Mensaje para mostrar al usuario según el resultado (o `null` si canceló).
  static String? mensaje(ResultadoPago resultado) => switch (resultado) {
    ResultadoPago.cancelado => null,
    ResultadoPago.checkoutAbierto =>
      'Checkout abierto. El estado se actualizará al volver.',
    ResultadoPago.reciboEnviado =>
      'Recibo enviado. Pago pendiente de revisión.',
  };

  /// Paga una factura pendiente desde Inicio o Mis facturas.
  static Future<ResultadoPago> pagarFactura(
    BuildContext context,
    ApiService api,
    Factura factura,
  ) async {
    int? mesesElegidos;
    Map<String, dynamic>? cotizacion;
    String subtitulo;

    if (factura.admitePlanes) {
      final plan = await mostrarPlanPagoSheet(context, api, factura.id);
      if (plan == null || !context.mounted) return ResultadoPago.cancelado;
      mesesElegidos =
          int.tryParse('${plan['meses']}') ?? factura.mesesCubiertos;
      cotizacion = plan;
      subtitulo = _subtituloPlan(plan, mesesElegidos, factura);
    } else {
      subtitulo = _subtituloFactura(factura);
    }

    final eleccion = await mostrarPagarSheet(context, subtitulo: subtitulo);
    if (eleccion == null || !context.mounted) return ResultadoPago.cancelado;

    final cambiaPlan =
        mesesElegidos != null && mesesElegidos != factura.mesesCubiertos;
    var planAplicado = false;
    Future<void> aplicarPlan() async {
      if (!cambiaPlan) return;
      await api.post(
        '/facturas/${factura.id}/plan-pago',
        body: {'meses': mesesElegidos},
      );
      planAplicado = true;
    }

    try {
      return await _cobrar(
        context,
        api,
        factura.id,
        eleccion.metodo,
        cotizacion: cotizacion,
        antesDeRegistrar: aplicarPlan,
      );
    } catch (_) {
      if (planAplicado) await _restaurarPlan(api, factura);
      rethrow;
    }
  }

  /// Vuelve a intentar un pago pendiente o rechazado desde Mis pagos. La
  /// factura conserva el plan que ya tiene.
  static Future<ResultadoPago> reintentarPago(
    BuildContext context,
    ApiService api,
    Pago pago,
  ) async {
    final eleccion = await mostrarPagarSheet(
      context,
      subtitulo: 'Valor del servicio: ${Formato.pesos(pago.monto)}',
    );
    if (eleccion == null || !context.mounted) return ResultadoPago.cancelado;
    return _cobrar(context, api, pago.facturaId, eleccion.metodo);
  }

  static Future<ResultadoPago> _cobrar(
    BuildContext context,
    ApiService api,
    String facturaId,
    String metodo, {
    Map<String, dynamic>? cotizacion,
    Future<void> Function()? antesDeRegistrar,
  }) async {
    switch (metodo) {
      case 'wompi':
        final abierto = await WompiCheckoutService.pagar(
          context,
          api,
          facturaId,
          cotizacion: cotizacion,
          antesDeRegistrar: antesDeRegistrar,
        );
        return abierto
            ? ResultadoPago.checkoutAbierto
            : ResultadoPago.cancelado;
      case 'fisico':
        final recibo = await ReciboPagoService.seleccionar();
        if (recibo == null) return ResultadoPago.cancelado;
        if (antesDeRegistrar != null) await antesDeRegistrar();
        await ReciboPagoService.enviar(api, facturaId, recibo);
        return ResultadoPago.reciboEnviado;
      default:
        throw ApiException('Medio de pago no disponible.');
    }
  }

  /// Devuelve la factura a su plan original. Si falla (por ejemplo, porque
  /// ya hay un pago en curso) no se insiste: el servidor libera los checkouts
  /// abandonados en 30 minutos y el usuario puede volver a elegir.
  static Future<void> _restaurarPlan(ApiService api, Factura factura) async {
    try {
      await api.post(
        '/facturas/${factura.id}/plan-pago',
        body: {'meses': factura.mesesCubiertos},
      );
    } catch (_) {}
  }

  static String _subtituloPlan(
    Map<String, dynamic> plan,
    int meses,
    Factura factura,
  ) {
    final servicio =
        num.tryParse('${plan['valorServicio']}') ?? factura.valorTotal;
    final inicio = Formato.periodo(plan['periodoInicio']?.toString());
    final fin = Formato.periodo(plan['periodoFin']?.toString());
    final periodo = meses > 1 ? '$inicio – $fin' : inicio;
    return '${nombrePlanPago(meses)} · $periodo · ${Formato.pesos(servicio)}';
  }

  static String _subtituloFactura(Factura factura) {
    final concepto = factura.esExtraordinaria
        ? (factura.observacion ?? 'Cuota extraordinaria')
        : Formato.periodo(factura.periodo);
    return '$concepto · ${Formato.pesos(factura.valorTotal)}';
  }
}
