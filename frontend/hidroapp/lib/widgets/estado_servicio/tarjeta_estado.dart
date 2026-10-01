import 'package:flutter/material.dart';

import '../../models/corte.dart';
import '../../theme/app_theme.dart';
import '../../utils/formato.dart';
import '../core/fila_detalle.dart';

/// Tarjeta principal del módulo "Estado del servicio": en verde si el agua
/// está activa, en rojo si está suspendida, con el motivo y la fecha del corte
/// vigente cuando lo hay.
class TarjetaEstadoServicio extends StatelessWidget {
  const TarjetaEstadoServicio({
    super.key,
    required this.cortado,
    this.corteActivo,
  });

  final bool cortado;
  final Corte? corteActivo;

  @override
  Widget build(BuildContext context) {
    final colores = AppColors.of(context);
    final color = cortado ? colores.danger : colores.success;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(AppTheme.cardRadius),
        border: Border.all(color: color.withValues(alpha: 0.30)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                cortado ? Icons.water_drop_outlined : Icons.water_drop,
                color: color,
                size: 28,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  cortado ? 'Servicio suspendido' : 'Servicio activo',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: color,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            cortado
                ? 'Tu suministro de agua está cortado en este momento.'
                : 'Tu suministro de agua funciona con normalidad.',
            style: const TextStyle(fontSize: 14, height: 1.35),
          ),
          if (cortado && corteActivo != null) ...[
            const SizedBox(height: 12),
            FilaDetalle(
              icono: Icons.info_outline,
              texto: 'Motivo: ${corteActivo!.motivo}',
            ),
            FilaDetalle(
              icono: Icons.event_busy_outlined,
              texto: 'Desde: ${Formato.fechaHora(corteActivo!.fechaCorte)}',
            ),
          ],
        ],
      ),
    );
  }
}
