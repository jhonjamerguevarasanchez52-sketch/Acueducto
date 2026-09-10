import 'dart:math' as math;

import 'package:flutter/material.dart';

/// Los tres puntitos de "cargando" que aparecen al final del ensamble del
/// splash y laten en secuencia mientras se espera la navegación.
class WelcomeLoadingDots extends StatelessWidget {
  const WelcomeLoadingDots({
    super.key,
    required this.mainValue,
    required this.bubblesValue,
  });

  /// Valor 0..1 del controlador del ensamble (`_main.value`).
  final double mainValue;

  /// Valor 0..1 del controlador en bucle de las burbujas de fondo.
  final double bubblesValue;

  @override
  Widget build(BuildContext context) {
    final visible = mainValue >= 0.98;
    return AnimatedOpacity(
      duration: const Duration(milliseconds: 300),
      opacity: visible ? 1 : 0,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: List<Widget>.generate(3, (i) {
          final v = 0.5 +
              0.5 *
                  math.sin(
                    bubblesValue * 2 * math.pi * 3 - i * (2 * math.pi / 3),
                  );
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 3),
            child: Opacity(
              opacity: 0.3 + 0.7 * v,
              child: const DecoratedBox(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white,
                ),
                child: SizedBox(width: 6, height: 6),
              ),
            ),
          );
        }),
      ),
    );
  }
}
