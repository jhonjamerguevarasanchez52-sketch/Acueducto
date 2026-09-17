import 'package:flutter/material.dart';

import '../../models/averia.dart';
import '../../theme/app_theme.dart';
import '../../utils/formato.dart';
import '../mensaje_estado.dart';

/// Tarjeta de una avería reportada: fecha, estado, descripción y, si el
/// fontanero la dejó, su nota y la fecha de resolución.
///
/// Cuando [onCambiarEstado] no es nulo (vista del fontanero) y la avería
/// sigue abierta, muestra botones para marcarla "en proceso" o "resuelta".
/// [actualizando] la controla la pantalla que la contiene: al vivir el flag
/// fuera de esta tarjeta, no se pierde si la lista se reconstruye con datos
/// frescos tras guardar el cambio (antes quedaba "pegado" mostrando el
/// spinner para siempre porque esta tarjeta reutilizaba su propio estado).
class AveriaCard extends StatelessWidget {
  const AveriaCard({
    super.key,
    required this.averia,
    this.onCambiarEstado,
    this.actualizando = false,
  });

  final Averia averia;
  final void Function(String nuevoEstado)? onCambiarEstado;
  final bool actualizando;

  ({String texto, Color color}) get _estado {
    switch (averia.estado) {
      case 'en_proceso':
        return (texto: 'En proceso', color: AppTheme.info);
      case 'resuelta':
        return (texto: 'Resuelta', color: AppTheme.success);
      case 'cancelada':
        return (texto: 'Cancelada', color: AppTheme.secondaryText);
      default:
        return (texto: 'Reportada', color: AppTheme.warning);
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
                    Formato.fecha(averia.fechaReporte),
                    style: const TextStyle(
                      fontSize: 13,
                      color: AppTheme.secondaryText,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                EtiquetaEstado(texto: estado.texto, color: estado.color),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              averia.descripcion,
              style: const TextStyle(fontSize: 15, height: 1.35),
            ),
            if (averia.notaFontanero != null) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppTheme.surfaceTint,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Nota del fontanero',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.5,
                        color: AppTheme.primaryDark,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      averia.notaFontanero!,
                      style: const TextStyle(fontSize: 13.5, height: 1.3),
                    ),
                  ],
                ),
              ),
            ],
            if (averia.fechaResolucion != null) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  const Icon(Icons.check_circle_outline,
                      size: 15, color: AppTheme.secondaryText),
                  const SizedBox(width: 6),
                  Text(
                    'Resuelta: ${Formato.fecha(averia.fechaResolucion)}',
                    style: const TextStyle(
                      fontSize: 13,
                      color: AppTheme.secondaryText,
                    ),
                  ),
                ],
              ),
            ],
            if (onCambiarEstado != null && !averia.cerrada) ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  if (averia.estado != 'en_proceso') ...[
                    Expanded(
                      child: OutlinedButton(
                        onPressed: actualizando
                            ? null
                            : () => onCambiarEstado!('en_proceso'),
                        child: const Text('Trabajando en ello'),
                      ),
                    ),
                    const SizedBox(width: 8),
                  ],
                  Expanded(
                    child: FilledButton(
                      onPressed: actualizando
                          ? null
                          : () => onCambiarEstado!('resuelta'),
                      child: actualizando
                          ? const SizedBox(
                              height: 18,
                              width: 18,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2, color: Colors.white),
                            )
                          : const Text('Solucionada'),
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
