import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../models/pago.dart';
import '../../theme/app_theme.dart';
import '../../utils/formato.dart';
import '../core/fila_detalle.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

/// Tarjeta de un pago del historial: monto, método, estado de confirmación y,
/// mientras no esté confirmado, un botón para volver a intentarlo.
class PagoCard extends StatelessWidget {
  const PagoCard({super.key, required this.pago, required this.onPagar});

  final Pago pago;

  /// Registra un nuevo intento de pago para esta factura. Solo tiene sentido
  /// mientras el pago no esté confirmado.
  final VoidCallback onPagar;

  static const _metodos = {
    'efectivo': 'Pago físico',
    'fisico': 'Pago físico',
    'nequi': 'Nequi',
    'pse': 'PSE',
    'tarjeta': 'Tarjeta',
    'transferencia': 'Transferencia',
    'wompi': 'Wompi',
  };

  ({String texto, Color color, IconData icono}) _estado(AppColors colores) {
    if (pago.confirmado) {
      return (
        texto: 'Confirmado',
        color: colores.success,
        icono: LucideIcons.circleCheck,
      );
    }
    if (pago.rechazado) {
      return (texto: 'Rechazado', color: colores.danger, icono: LucideIcons.circleX);
    }
    if (pago.requiereRevision) {
      return (
        texto: 'Requiere revisión del acueducto',
        color: colores.warning,
        icono: LucideIcons.headset,
      );
    }
    if (pago.reembolsado) {
      return (
        texto: 'El acueducto te devolvió este cobro',
        color: colores.secondaryText,
        icono: LucideIcons.info,
      );
    }
    if (pago.reemplazado) {
      return (
        texto: 'Intento cerrado: ya no está en curso',
        color: colores.secondaryText,
        icono: LucideIcons.info,
      );
    }
    if (pago.abandonado()) {
      return (
        texto: 'El pago en línea no se completó',
        color: colores.secondaryText,
        icono: LucideIcons.info,
      );
    }
    if (pago.estadoWompi == 'PENDING') {
      return (
        texto: 'Esperando respuesta de Wompi',
        color: colores.warning,
        icono: LucideIcons.hourglass,
      );
    }
    return (
      texto: 'Pendiente de confirmación',
      color: colores.warning,
      icono: LucideIcons.hourglass,
    );
  }

  @override
  Widget build(BuildContext context) {
    final colores = AppColors.of(context);
    final estado = _estado(colores);
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
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: colores.info,
                    ),
                  ),
                ),
                Text(
                  metodo,
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    color: colores.secondaryText,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Icon(estado.icono, size: 16, color: estado.color),
                const SizedBox(width: 6),
                Flexible(
                  child: Text(
                    estado.texto,
                    style: TextStyle(
                      color: estado.color,
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            FilaDetalle(
              icono: LucideIcons.calendar,
              texto: 'Registrado: ${Formato.fechaHora(pago.fechaPago)}',
            ),
            if (pago.cargoWompi > 0)
              FilaDetalle(
                icono: LucideIcons.wallet,
                texto: 'Cargo Wompi: ${Formato.pesos(pago.cargoWompi)}',
              ),
            if (pago.montoTotal != null)
              FilaDetalle(
                icono: LucideIcons.banknote,
                texto: 'Total cobrado: ${Formato.pesos(pago.montoTotal)}',
              ),
            if (pago.confirmado && pago.fechaConfirmacion != null)
              FilaDetalle(
                icono: LucideIcons.badgeCheck,
                texto:
                    'Confirmado: ${Formato.fechaHora(pago.fechaConfirmacion)}',
              ),
            if (pago.referencia != null && pago.metodo != 'fisico')
              FilaDetalle(
                icono: LucideIcons.hash,
                texto: 'Referencia: ${pago.referencia}',
              ),
            if (pago.transaccionId != null)
              FilaDetalle(
                icono: LucideIcons.receiptText,
                texto: 'Transacción Wompi: ${pago.transaccionId}',
              ),
            if (pago.medioPagoWompi != null)
              FilaDetalle(
                icono: LucideIcons.creditCard,
                texto: 'Medio Wompi: ${Formato.etiqueta(pago.medioPagoWompi)}',
              ),
            if (pago.reciboUrl != null) ...[
              const SizedBox(height: 6),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  onPressed: () => launchUrl(
                    Uri.parse(pago.reciboUrl!),
                    mode: LaunchMode.externalApplication,
                  ),
                  icon: const Icon(LucideIcons.receiptText, size: 18),
                  label: const Text('Ver recibo enviado'),
                ),
              ),
            ],
            if (!pago.confirmado && (pago.rechazado || pago.abandonado())) ...[
              const SizedBox(height: 14),
              FilledButton.icon(
                onPressed: onPagar,
                icon: const Icon(LucideIcons.banknote, size: 18),
                label: const Text('Volver a pagar'),
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
