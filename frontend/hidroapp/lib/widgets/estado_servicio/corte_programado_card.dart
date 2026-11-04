import 'package:flutter/material.dart';

import '../../models/corte.dart';
import '../../theme/app_theme.dart';
import '../../utils/formato.dart';
import '../core/fila_detalle.dart';
import '../core/mensaje_estado.dart';

/// Aviso de un corte programado por el acueducto (mantenimiento o daño
/// general): cuándo empieza, cuándo termina, el motivo y a qué zona aplica.
class CorteProgramadoCard extends StatelessWidget {
  const CorteProgramadoCard({super.key, required this.corte});

  final CorteProgramado corte;

  @override
  Widget build(BuildContext context) {
    final colores = AppColors.of(context);
    final enCurso = corte.enCurso();
    final color = enCurso ? colores.danger : colores.warning;
    return Card(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: color.withValues(alpha: 0.5)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.campaign_outlined, color: color),
                const SizedBox(width: 8),
                const Expanded(
                  child: Text(
                    'Corte de agua programado',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                  ),
                ),
                EtiquetaEstado(
                  texto: enCurso ? 'En curso' : 'Próximo',
                  color: color,
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(corte.motivo),
            const SizedBox(height: 8),
            FilaDetalle(
              icono: Icons.schedule,
              texto: 'Desde: ${Formato.fechaHora(corte.inicio)}',
            ),
            FilaDetalle(
              icono: Icons.event_available_outlined,
              texto: 'Hasta: ${Formato.fechaHora(corte.fin)}',
            ),
            FilaDetalle(
              icono: Icons.place_outlined,
              texto: corte.zona == null ? 'Todo el acueducto' : 'Zona ${corte.zona}',
            ),
            if (!enCurso) ...[
              const SizedBox(height: 6),
              Text(
                'Te recomendamos almacenar agua antes del corte.',
                style: TextStyle(color: colores.secondaryText, fontSize: 12.5),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
