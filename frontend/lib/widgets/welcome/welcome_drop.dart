import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../hidro_logo.dart';
import 'half_clipper.dart';
import 'welcome_common.dart';

/// La gota del logo del splash: dos mitades que se cierran con una pequeña
/// vibración, la flecha de "enviar ubicación" que gira hasta su sitio, unas
/// burbujas y, ya ensamblada, un flotado suave.
class WelcomeDrop extends StatelessWidget {
  const WelcomeDrop({
    super.key,
    required this.phase,
    required this.dropIdle,
    required this.assembled,
    required this.dropShake,
  });

  final EnsamblePhase phase;

  /// Valor 0..1 del controlador de flotado en bucle.
  final double dropIdle;

  /// `true` cuando el ensamble terminó y arranca el flotado idle.
  final bool assembled;

  /// Desplazamiento horizontal de la vibración al cerrarse la gota.
  final double dropShake;

  @override
  Widget build(BuildContext context) {
    final tHalves = kDropHalvesInt.transform(phase.t);
    final off = 1.0 - tHalves;
    final dx = 120.0 * off;
    final ang = 1.6 * off;
    final opacity = phase.win(0.30, 0.40).clamp(0.0, 1.0);

    final floatDy =
        assembled ? math.sin(dropIdle * 2 * math.pi) * 6.0 : 0.0;
    final floatRot =
        assembled ? math.sin(dropIdle * 2 * math.pi) * 0.08 : 0.0;

    Widget half(bool left) => RepaintBoundary(
      child: ClipRect(
        clipper: HalfClipper(left: left),
        child: CustomPaint(
          size: const Size(100, 110),
          painter: HidroDropPainter(),
        ),
      ),
    );

    return Transform.translate(
      offset: Offset(dropShake, floatDy),
      child: Transform(
        alignment: Alignment.center,
        transform: welcomePerspective(floatRot),
        child: SizedBox(
          width: 110,
          height: 120,
          child: Stack(
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
                opacity: (phase.flash(kDropFlashA, kDropFlashB) * 0.4).clamp(
                  0.0,
                  1.0,
                ),
                child: Container(
                  width: 92,
                  height: 92,
                  decoration: kWelcomeRadialWhite,
                ),
              ),
              _arrow(),
              ..._bubbles(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _arrow() {
    final t = kArrowInt.transform(phase.t);
    final ang = 1.2 * (1.0 - t);
    return Transform.translate(
      offset: const Offset(0, 6),
      child: Opacity(
        opacity: t.clamp(0.0, 1.0),
        child: Transform(
          alignment: Alignment.center,
          transform: welcomePerspective(0, ang),
          child: RepaintBoundary(
            child: CustomPaint(
              size: const Size(30, 30),
              painter: HidroArrowPainter(),
            ),
          ),
        ),
      ),
    );
  }

  List<Widget> _bubbles() {
    const positions = <Offset>[Offset(-14, 8), Offset(11, -2), Offset(3, 22)];
    const sizes = <double>[7, 5, 6];

    return List<Widget>.generate(3, (i) {
      final start = kDropBubStart + i * kDropBubStep;
      final s = phase.win(start, start + kDropBubLen, Curves.elasticOut);
      return Transform.translate(
        offset: positions[i],
        child: Opacity(
          opacity: s.clamp(0.0, 1.0),
          child: Transform.scale(
            scale: s.clamp(0.0, 1.15),
            child: Container(
              width: sizes[i],
              height: sizes[i],
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    Colors.white.withValues(alpha: 0.9),
                    Colors.white.withValues(alpha: 0.15),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
    });
  }
}
