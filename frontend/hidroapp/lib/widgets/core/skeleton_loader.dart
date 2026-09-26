import 'package:flutter/material.dart';

import '../../theme/app_theme.dart';

/// Placeholder de carga para listas (facturas, averías, pagos, notificaciones,
/// estado del servicio): unas cuantas tarjetas grises con un brillo que las
/// recorre, en vez de un `CircularProgressIndicator` suelto en el centro.
class SkeletonLista extends StatefulWidget {
  const SkeletonLista({super.key, this.cantidad = 4, this.alturaItem = 84});

  final int cantidad;
  final double alturaItem;

  @override
  State<SkeletonLista> createState() => _SkeletonListaState();
}

class _SkeletonListaState extends State<SkeletonLista>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1300),
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      physics: const NeverScrollableScrollPhysics(),
      itemCount: widget.cantidad,
      separatorBuilder: (_, _) => const SizedBox(height: 12),
      itemBuilder: (context, i) => AnimatedBuilder(
        animation: _controller,
        builder: (context, _) => _CajaBrillante(
          progreso: _controller.value,
          alto: widget.alturaItem,
        ),
      ),
    );
  }
}

class _CajaBrillante extends StatelessWidget {
  const _CajaBrillante({required this.progreso, required this.alto});

  final double progreso;
  final double alto;

  @override
  Widget build(BuildContext context) {
    // El degradado se desliza de izquierda a derecha en bucle: el resaltado
    // claro entra por fuera del borde izquierdo y sale por el derecho.
    final desplazamiento = -1.5 + progreso * 3;
    return Container(
      height: alto,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppTheme.cardRadius),
        gradient: LinearGradient(
          begin: Alignment(desplazamiento - 0.6, 0),
          end: Alignment(desplazamiento + 0.6, 0),
          colors: const [
            Color(0xFFE7EEF2),
            Color(0xFFF4F8FA),
            Color(0xFFE7EEF2),
          ],
        ),
      ),
    );
  }
}
