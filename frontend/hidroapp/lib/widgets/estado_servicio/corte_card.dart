import 'package:flutter/material.dart';

import '../../models/corte.dart';
import '../../theme/app_theme.dart';
import '../../utils/formato.dart';
import '../fila_detalle.dart';
import '../mensaje_estado.dart';

/// Tarjeta de un corte del historial: motivo, si sigue activo o ya se resolvió,
/// y las fechas de corte y reconexión.
class CorteCard extends StatelessWidget {
  const CorteCard({super.key, required this.corte});

  final Corte corte;

  @override
  Widget build(BuildContext context) {
    final activo = corte.activo;
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
                    corte.motivo,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                EtiquetaEstado(
                  texto: activo ? 'Activo' : 'Resuelto',
                  color: activo ? AppTheme.danger : AppTheme.success,
                ),
              ],
            ),
            const SizedBox(height: 8),
            FilaDetalle(
              icono: Icons.event_busy_outlined,
              texto: 'Corte: ${Formato.fechaHora(corte.fechaCorte)}',
            ),
            if (corte.fechaReconexion != null)
              FilaDetalle(
                icono: Icons.event_available_outlined,
                texto:
                    'Reconexión: ${Formato.fechaHora(corte.fechaReconexion)}',
              ),
          ],
        ),
      ),
    );
  }
}
