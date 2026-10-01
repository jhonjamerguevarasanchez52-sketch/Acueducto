import 'package:flutter/material.dart';

import '../../theme/app_theme.dart';

/// Mensaje centrado a pantalla completa para los estados "vacío" y "error"
/// de las listas de los módulos (facturas, pagos, averías, etc.).
///
/// Va dentro de un `ListView` (con `physics: AlwaysScrollableScrollPhysics`)
/// para que el `RefreshIndicator` siga funcionando aunque no haya contenido.
class MensajeEstado extends StatelessWidget {
  const MensajeEstado({
    super.key,
    required this.icono,
    required this.titulo,
    this.detalle,
    this.onReintentar,
  });

  /// Estado de error estándar: ícono de nube tachada y botón de reintento.
  const MensajeEstado.error({
    super.key,
    required String mensaje,
    required VoidCallback this.onReintentar,
  })  : icono = Icons.cloud_off_outlined,
        titulo = 'No se pudo cargar',
        detalle = mensaje;

  final IconData icono;
  final String titulo;
  final String? detalle;
  final VoidCallback? onReintentar;

  @override
  Widget build(BuildContext context) {
    final colores = AppColors.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(32, 64, 32, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: colores.chipBackground,
                shape: BoxShape.circle,
              ),
              child: Icon(icono, size: 34, color: colores.info),
            ),
            const SizedBox(height: 16),
            Text(
              titulo,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
              ),
            ),
            if (detalle != null) ...[
              const SizedBox(height: 6),
              Text(
                detalle!,
                textAlign: TextAlign.center,
                style: TextStyle(color: colores.secondaryText),
              ),
            ],
            if (onReintentar != null) ...[
              const SizedBox(height: 20),
              OutlinedButton.icon(
                onPressed: onReintentar,
                icon: const Icon(Icons.refresh),
                label: const Text('Reintentar'),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size(0, 44),
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Pastilla de color para el estado de una factura, avería, pago o corte.
class EtiquetaEstado extends StatelessWidget {
  const EtiquetaEstado({
    super.key,
    required this.texto,
    required this.color,
  });

  final String texto;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        texto,
        style: TextStyle(
          color: color,
          fontSize: 12,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
