import 'dart:math' as math;

import 'package:flutter/material.dart';

/// Piezas compartidas por las capas del splash animado (`WelcomeScreen`): las
/// ventanas de tiempo de cada fase del ensamble, el helper para leer el avance
/// dentro de una ventana y un par de utilidades de dibujo.

// ---------------------------------------------------------------------------
//  Fases del ensamble (fracciones de assembleDuration, 0..1)
// ---------------------------------------------------------------------------
const Interval kRingHalvesInt = Interval(0.00, 0.22, curve: Curves.easeOutBack);
const double kRingFlashA = 0.18, kRingFlashB = 0.34;
const double kRingDotStart = 0.16, kRingDotStep = 0.02, kRingDotLen = 0.10;

const Interval kDropHalvesInt = Interval(0.30, 0.54, curve: Curves.easeOutBack);
const double kDropFlashA = 0.50, kDropFlashB = 0.60;
const Interval kArrowInt = Interval(0.56, 0.72, curve: Curves.easeOut);
const double kDropBubStart = 0.68, kDropBubStep = 0.07, kDropBubLen = 0.10;

const Interval kHaShadowInt = Interval(0.58, 0.70);
const Interval kHaLettersInt = Interval(0.74, 0.90, curve: Curves.easeOutBack);
const double kHaFlashA = 0.74, kHaFlashB = 0.90;
const Interval kTextFadeInt = Interval(0.90, 1.00);

/// Lee el avance del controlador principal del ensamble ([t] == `_main.value`)
/// dentro de las distintas ventanas de fase.
class EnsamblePhase {
  const EnsamblePhase(this.t);

  final double t;

  /// Avance 0 → 1 dentro de la ventana [a, b], con la curva indicada.
  double win(double a, double b, [Curve curve = Curves.linear]) {
    final v = ((t - a) / (b - a)).clamp(0.0, 1.0);
    return curve.transform(v);
  }

  /// Pulso 0 → 1 → 0 dentro de la ventana [a, b] (para los destellos).
  double flash(double a, double b) {
    final v = ((t - a) / (b - a)).clamp(0.0, 1.0);
    return math.sin(v * math.pi);
  }
}

/// Matriz con perspectiva para los giros 3D de las placas.
Matrix4 welcomePerspective(double angleY, [double angleX = 0]) =>
    Matrix4.identity()
      ..setEntry(3, 2, 0.0016)
      ..rotateX(angleX)
      ..rotateY(angleY);

/// Halo circular blanco que se usa como destello al cerrarse cada pieza.
const BoxDecoration kWelcomeRadialWhite = BoxDecoration(
  shape: BoxShape.circle,
  gradient: RadialGradient(colors: [Colors.white, Color(0x00FFFFFF)]),
);
