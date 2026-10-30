import 'package:flutter/material.dart';

import '../../models/factura.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import '../../utils/formato.dart';
import 'home_factura_widgets.dart';

/// Tarjeta de la factura pendiente en la pestaña "Inicio": periodo, valor,
/// vencimiento, anillo de avance del ciclo y botón "Pagar ahora". Si no hay
/// nada pendiente muestra un estado tranquilo; si algo falla, un aviso
/// discreto.
class ProximaFactura extends StatelessWidget {
  const ProximaFactura({super.key, required this.snap, required this.onPagar});

  final AsyncSnapshot<List<Factura>> snap;
  final Future<void> Function(Factura) onPagar;

  int _diasHasta(DateTime venc) {
    final hoy = DateTime.now();
    final h = DateTime(hoy.year, hoy.month, hoy.day);
    final v = DateTime(venc.year, venc.month, venc.day);
    return v.difference(h).inDays;
  }

  /// Avance del ciclo de facturación entre la emisión y el vencimiento (0..1).
  double _avance(Factura f) {
    final venc = f.fechaVencimiento;
    if (venc == null) return 0;
    final emision = f.fechaEmision ?? venc.subtract(const Duration(days: 30));
    final total = venc.difference(emision).inMinutes;
    if (total <= 0) return 1;
    final transcurrido = DateTime.now().difference(emision).inMinutes;
    return (transcurrido / total).clamp(0.0, 1.0);
  }

  @override
  Widget build(BuildContext context) {
    final colores = AppColors.of(context);

    if (snap.connectionState == ConnectionState.waiting) {
      return const CajaBlanca(
        child: Row(
          children: [
            SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(strokeWidth: 2.4),
            ),
            SizedBox(width: 14),
            Flexible(child: Text('Cargando tu factura…')),
          ],
        ),
      );
    }

    if (snap.hasError) {
      return CajaBlanca(
        child: Row(
          children: [
            Icon(Icons.cloud_off_outlined, color: colores.secondaryText),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                snap.error is ApiException
                    ? (snap.error as ApiException).message
                    : 'No se pudo cargar tu factura.',
                style: const TextStyle(fontSize: 13),
              ),
            ),
          ],
        ),
      );
    }

    final facturas = snap.data ?? const <Factura>[];
    // Las facturas sin fecha límite también se deben: van después de las
    // que sí tienen vencimiento, para no mostrar "Estás al día" por error.
    final pendientes = facturas.where((f) => f.estaPendiente).toList()
      ..sort((a, b) {
        final va = a.fechaVencimiento;
        final vb = b.fechaVencimiento;
        if (va == null || vb == null) {
          return va == null ? (vb == null ? 0 : 1) : -1;
        }
        return va.compareTo(vb);
      });

    if (pendientes.isEmpty) {
      final sinFacturas = facturas.isEmpty;
      return CajaBlanca(
        child: Row(
          children: [
            Icon(Icons.check_circle, color: colores.success, size: 30),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    sinFacturas ? 'Sin facturas' : 'Estás al día',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color: colores.success,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    sinFacturas
                        ? 'Todavía no tienes facturas emitidas.'
                        : 'No tienes facturas pendientes de pago.',
                    style: const TextStyle(fontSize: 13),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    final factura = pendientes.first;
    final vencimiento = factura.fechaVencimiento;
    final dias = vencimiento == null ? null : _diasHasta(vencimiento);
    final avance = _avance(factura);

    final Color color;
    final String aviso;
    if (dias == null) {
      color = factura.estado == 'vencida' ? colores.danger : colores.info;
      aviso = factura.estado == 'vencida' ? 'Factura vencida' : 'Sin fecha límite';
    } else if (dias < 0) {
      color = colores.danger;
      aviso = dias == -1 ? 'Venció hace 1 día' : 'Venció hace ${-dias} días';
    } else if (dias == 0) {
      color = colores.warning;
      aviso = 'Vence hoy';
    } else if (dias <= 5) {
      color = colores.warning;
      aviso = dias == 1 ? 'Vence mañana' : 'Faltan $dias días';
    } else {
      color = colores.info;
      aviso = 'Faltan $dias días';
    }

    return CajaBlanca(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      Formato.periodo(factura.periodo),
                      style: TextStyle(
                        fontSize: 13,
                        color: colores.secondaryText,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      Formato.pesos(factura.valorTotal),
                      style: TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.w800,
                        color: Theme.of(context).colorScheme.onSurface,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      vencimiento == null
                          ? 'Emitida: ${Formato.fecha(factura.fechaEmision)}'
                          : 'Vence: ${Formato.fecha(vencimiento)}',
                      style: TextStyle(
                        fontSize: 12.5,
                        color: colores.secondaryText,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              AnilloAvance(valor: avance, color: color),
            ],
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.schedule, size: 14, color: color),
                const SizedBox(width: 6),
                Text(
                  aviso,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: color,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          BotonPagarAhora(onPressed: () => onPagar(factura)),
        ],
      ),
    );
  }
}
