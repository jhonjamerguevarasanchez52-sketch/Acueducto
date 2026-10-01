import 'dart:async';

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
  late final Animation<Offset> _desplazamiento;
  Timer? _temporizador;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: AppTheme.motionEntrada,
    );
    _curva = CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic);
    _desplazamiento = Tween<Offset>(
      begin: const Offset(0, 0.035),
      end: Offset.zero,
    ).animate(_curva);
    final retrasoMs = widget.retraso.inMilliseconds.clamp(0, 180).toInt();
    _temporizador = Timer(Duration(milliseconds: retrasoMs), () {
      if (mounted) _controller.forward();
    });
  }

  @override
  void dispose() {
    _temporizador?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _curva,
      child: SlideTransition(
        position: _desplazamiento,
        child: widget.child,
      ),
    );
  }
}
