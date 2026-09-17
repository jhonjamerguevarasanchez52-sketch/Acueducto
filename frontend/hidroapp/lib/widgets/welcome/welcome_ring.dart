import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../hidro_logo.dart';
import 'half_clipper.dart';
import 'welcome_common.dart';

/// El anillo del logo del splash: dos mitades que entran deslizándose y giran
/// para cerrarse, los 4 puntos cardinales que aparecen con rebote y, una vez
/// ensamblado, un giro 3D lento y continuo.
class WelcomeRing extends StatelessWidget {
  const WelcomeRing({
    super.key,
    required this.phase,
    required this.ringIdle,
    required this.assembled,
  });

  final EnsamblePhase phase;

  /// Valor 0..1 del controlador de giro en bucle.
  final double ringIdle;

  /// `true` cuando el ensamble terminó y arranca el giro idle.
  final bool assembled;

  @override
  Widget build(BuildContext context) {
    final tHalves = kRingHalvesInt.transform(phase.t);
    final off = 1.0 - tHalves;
    final dx = 190.0 * off;
    final ang = 1.5 * off;
    final opacity = phase.win(0.02, 0.14).clamp(0.0, 1.0);
    final idleAngle = assembled ? ringIdle * 2 * math.pi : 0.0;

    Widget half(bool left) => RepaintBoundary(
      child: ClipRect(
        clipper: HalfClipper(left: left),
        child: CustomPaint(
          size: const Size(170, 170),
          painter: HidroRingPainter(),
        ),
      ),
    );

    final assembledStack = Stack(
      alignment: Alignment.center,
      children: [
        Opacity(
          opacity: opacity,
          child: Transform.translate(
            offset: Offset(-dx, 0),
            child: Transform(
              alignment: Alignment.center,
              transform: welcomePerspective(-ang),
              child: half(true),
            ),
          ),
        ),
        Opacity(
          opacity: opacity,
          child: Transform.translate(
            offset: Offset(dx, 0),
            child: Transform(
              alignment: Alignment.center,
              transform: welcomePerspective(ang),
              child: half(false),
            ),
          ),
        ),
        Opacity(
          opacity: (phase.flash(kRingFlashA, kRingFlashB) * 0.35).clamp(0.0, 1.0),
          child: Container(
            width: 150,
            height: 150,
            decoration: kWelcomeRadialWhite,
          ),
        ),
        ..._dots(),
      ],
    );

    return Transform(
      alignment: Alignment.center,
      transform: welcomePerspective(idleAngle),
      child: assembledStack,
    );
  }

  List<Widget> _dots() {
    const positions = <double>[
      -math.pi / 2, // N
      0.0, // E
      math.pi / 2, // S
      math.pi, // W
    ];
    const ringRadius = 83.0;

    return List<Widget>.generate(4, (i) {
      final start = kRingDotStart + i * kRingDotStep;
      final s = phase.win(start, start + kRingDotLen, Curves.elasticOut);
      final a = positions[i];
      return Transform.translate(
        offset: Offset(math.cos(a) * ringRadius, math.sin(a) * ringRadius),
        child: Opacity(
          opacity: s.clamp(0.0, 1.0),
          child: Transform.scale(
            scale: s.clamp(0.0, 1.15),
            child: _cardinalDot(),
          ),
        ),
      );
    });
  }

  Widget _cardinalDot() => Container(
    width: 18,
    height: 18,
    decoration: BoxDecoration(
      shape: BoxShape.circle,
      gradient: const RadialGradient(
        colors: [Color(0xFFC7E9F2), Color(0xFF3FB8D8), Color(0xFF0C6F8F)],
      ),
      border: Border.all(
        color: Colors.white.withValues(alpha: 0.9),
        width: 1.5,
      ),
      boxShadow: [
        BoxShadow(
          color: Colors.black.withValues(alpha: 0.18),
          blurRadius: 3,
          offset: const Offset(0, 1),
        ),
      ],
    ),
  );
}
