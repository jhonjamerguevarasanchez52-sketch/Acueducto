import 'package:flutter/material.dart';

import '../../models/factura.dart';
import '../../theme/app_theme.dart';
import '../../utils/formato.dart';
import '../core/fila_detalle.dart';
import '../core/hidro_logo.dart';
import '../core/mensaje_estado.dart';

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

  ({String texto, Color color}) _estado(AppColors colores) {
    switch (factura.estado) {
      case 'pagada':
        return (texto: 'Pagada', color: colores.success);
      case 'anulada':
        return (texto: 'Anulada', color: colores.secondaryText);
      case 'vencida':
        return (texto: 'Vencida', color: colores.danger);
      default:
        return factura.estaVencida
            ? (texto: 'Vencida', color: colores.danger)
            : (texto: 'Pendiente', color: colores.warning);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colores = AppColors.of(context);
    final estado = _estado(colores);
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [AppTheme.midBlue, AppTheme.deepBlue],
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const HidroLogo(size: 38, withBadge: false),
                    const SizedBox(width: 10),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'HIDRO-APP',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 14,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          Text(
                            'ACUEDUCTO CAMPO AMOR',
                            style: TextStyle(
                              color: Colors.white70,
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                    EtiquetaEstado(texto: estado.texto, color: estado.color),
                  ],
                ),
                const SizedBox(height: 16),
                const Text(
                  'FACTURA DE SERVICIO',
                  style: TextStyle(
                    color: Colors.white70,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  Formato.periodo(factura.periodo),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
          Stack(
            children: [
              Positioned(
                right: -12,
                top: 12,
                child: IgnorePointer(
                  child: Opacity(
                    opacity: 0.04,
                    child: HidroLogo(size: 190, withBadge: false),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'TOTAL A PAGAR',
                      style: TextStyle(
                        color: colores.secondaryText,
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      Formato.pesos(factura.valorTotal),
                      style: TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.w800,
                        color: colores.info,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Divider(color: colores.cardBorder, height: 1),
                    const SizedBox(height: 10),
                    FilaDetalle(
                      icono: Icons.event_available_outlined,
                      texto: 'Emitida: ${Formato.fecha(factura.fechaEmision)}',
                    ),
                    if (factura.fechaVencimiento != null)
                      FilaDetalle(
                        icono: Icons.schedule_outlined,
                        texto:
                            'Vence: ${Formato.fecha(factura.fechaVencimiento)}',
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
                              icon: const Icon(
                                Icons.payments_outlined,
                                size: 18,
                              ),
                              label: const Text('Pagar'),
                              style: FilledButton.styleFrom(
                                minimumSize: const Size.fromHeight(44),
                                backgroundColor: const Color(0xFF007A55),
                                foregroundColor: Colors.white,
                                elevation: 2,
                                shadowColor: const Color(0xFF007A55),
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
                                foregroundColor: Theme.of(
                                  context,
                                ).colorScheme.primary,
                                backgroundColor: Theme.of(
                                  context,
                                ).colorScheme.primary.withValues(alpha: 0.08),
                                side: BorderSide(
                                  color: Theme.of(
                                    context,
                                  ).colorScheme.primary.withValues(alpha: 0.55),
                                ),
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
            ],
          ),
        ],
      ),
    );
  }
}
