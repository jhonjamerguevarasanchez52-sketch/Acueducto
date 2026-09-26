import 'package:flutter/material.dart';

import '../../theme/app_theme.dart';

/// Envuelve un widget para que aparezca con un desvanecido + deslizado hacia
/// arriba al montarse, con un [retraso] opcional. Se usa para que las listas
/// (facturas, averías, notificaciones, pagos...) entren en cascada en vez de
/// aparecer todas de golpe.
class EntradaAnimada extends StatefulWidget {
  const EntradaAnimada({
    super.key,
    required this.child,
    this.retraso = Duration.zero,
  });

  final Widget child;
  final Duration retraso;

  @override
  State<EntradaAnimada> createState() => _EntradaAnimadaState();
}

class _EntradaAnimadaState extends State<EntradaAnimada>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _curva;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: AppTheme.motionEntrada,
    );
    _curva = CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic);
    Future.delayed(widget.retraso, () {
      if (mounted) _controller.forward();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _curva,
      builder: (context, hijo) => Opacity(
        opacity: _curva.value,
        child: Transform.translate(
          offset: Offset(0, (1 - _curva.value) * 20),
          child: hijo,
        ),
      ),
      child: widget.child,
    );
  }
}
