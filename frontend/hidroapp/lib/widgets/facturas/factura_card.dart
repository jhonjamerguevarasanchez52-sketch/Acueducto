import 'package:flutter/material.dart';

import '../../models/factura.dart';
import '../../theme/app_theme.dart';
import '../../utils/formato.dart';
import '../fila_detalle.dart';
import '../mensaje_estado.dart';

/// Tarjeta de una factura: periodo, valor, fechas y observación. Si está
/// pendiente muestra los botones "Pagar" y "Mis pagos".
class FacturaCard extends StatelessWidget {
  const FacturaCard({
    super.key,
    required this.factura,
    required this.onPagar,
    required this.onVerPagos,
  });

  final Factura factura;
  final VoidCallback onPagar;
  final VoidCallback onVerPagos;

  ({String texto, Color color}) get _estado {
    switch (factura.estado) {
      case 'pagada':
        return (texto: 'Pagada', color: AppTheme.success);
      case 'anulada':
        return (texto: 'Anulada', color: AppTheme.secondaryText);
      case 'vencida':
        return (texto: 'Vencida', color: AppTheme.danger);
      default:
        return factura.estaVencida
            ? (texto: 'Vencida', color: AppTheme.danger)
            : (texto: 'Pendiente', color: AppTheme.warning);
    }
  }

  @override
  Widget build(BuildContext context) {
    final estado = _estado;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    Formato.periodo(factura.periodo),
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                EtiquetaEstado(texto: estado.texto, color: estado.color),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              Formato.pesos(factura.valorTotal),
              style: const TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: AppTheme.primaryDark,
              ),
            ),
            const SizedBox(height: 8),
            FilaDetalle(
              icono: Icons.event_available_outlined,
              texto: 'Emitida: ${Formato.fecha(factura.fechaEmision)}',
            ),
            if (factura.fechaVencimiento != null)
              FilaDetalle(
                icono: Icons.schedule_outlined,
                texto: 'Vence: ${Formato.fecha(factura.fechaVencimiento)}',
              ),
            if (factura.observacion != null)
              FilaDetalle(
                icono: Icons.sticky_note_2_outlined,
                texto: factura.observacion!,
              ),
            if (factura.estaPendiente) ...[
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: onPagar,
                      icon: const Icon(Icons.payments_outlined, size: 18),
                      label: const Text('Pagar'),
                      style: FilledButton.styleFrom(
                        minimumSize: const Size.fromHeight(44),
                        textStyle: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: onVerPagos,
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size.fromHeight(44),
                        textStyle: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      child: const Text('Mis pagos'),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
