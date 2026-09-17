import 'package:flutter/material.dart';

import '../../models/pago.dart';
import '../../theme/app_theme.dart';
import '../../utils/formato.dart';
import '../fila_detalle.dart';

/// Tarjeta de un pago del historial: monto, método, estado de confirmación y,
/// mientras no esté confirmado, un botón para volver a intentarlo.
class PagoCard extends StatelessWidget {
  const PagoCard({super.key, required this.pago, required this.onPagar});

  final Pago pago;

  /// Registra un nuevo intento de pago para esta factura. Solo tiene sentido
  /// mientras el pago no esté confirmado.
  final VoidCallback onPagar;

  static const _metodos = {
    'efectivo': 'Efectivo',
    'nequi': 'Nequi',
    'pse': 'PSE',
    'tarjeta': 'Tarjeta',
    'transferencia': 'Transferencia',
    'wompi': 'Wompi',
  };

  ({String texto, Color color, IconData icono}) get _estado {
    if (pago.confirmado) {
      return (
        texto: 'Confirmado',
        color: AppTheme.success,
        icono: Icons.check_circle,
      );
    }
    if (pago.rechazado) {
      return (
        texto: 'Rechazado',
        color: AppTheme.danger,
        icono: Icons.cancel,
      );
    }
    return (
      texto: 'Pendiente de confirmación',
      color: AppTheme.warning,
      icono: Icons.hourglass_bottom,
    );
  }

  @override
  Widget build(BuildContext context) {
    final estado = _estado;
    final metodo = _metodos[pago.metodo] ?? Formato.etiqueta(pago.metodo);

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
                    Formato.pesos(pago.monto),
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: AppTheme.primaryDark,
                    ),
                  ),
                ),
                Text(
                  metodo,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    color: AppTheme.secondaryText,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Icon(estado.icono, size: 16, color: estado.color),
                const SizedBox(width: 6),
                Text(
                  estado.texto,
                  style: TextStyle(
                    color: estado.color,
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            FilaDetalle(
              icono: Icons.event_outlined,
              texto: 'Registrado: ${Formato.fechaHora(pago.fechaPago)}',
            ),
            if (pago.confirmado && pago.fechaConfirmacion != null)
              FilaDetalle(
                icono: Icons.verified_outlined,
                texto:
                    'Confirmado: ${Formato.fechaHora(pago.fechaConfirmacion)}',
              ),
            if (pago.referencia != null)
              FilaDetalle(
                icono: Icons.tag,
                texto: 'Referencia: ${pago.referencia}',
              ),
            if (!pago.confirmado) ...[
              const SizedBox(height: 14),
              FilledButton.icon(
                onPressed: onPagar,
                icon: const Icon(Icons.payments_outlined, size: 18),
                label: Text(pago.rechazado ? 'Volver a pagar' : 'Pagar'),
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(44),
                  textStyle: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
