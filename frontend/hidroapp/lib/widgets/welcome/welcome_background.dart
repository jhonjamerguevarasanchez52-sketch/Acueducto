import 'dart:math' as math;

import 'package:flutter/material.dart';

/// Fondo del splash: el degradado azul estático, dos ondas Bézier abajo y una
/// capa de burbujas que suben en bucle. El degradado y las ondas nunca se
/// repintan; solo las burbujas se animan, aisladas en su propio
/// [RepaintBoundary].
class WelcomeBackground extends StatefulWidget {
  const WelcomeBackground({super.key, required this.bubbles});

  /// Controlador en bucle (0..1) que mueve las burbujas.
  final Animation<double> bubbles;

  @override
  State<WelcomeBackground> createState() => _WelcomeBackgroundState();
}

class _WelcomeBackgroundState extends State<WelcomeBackground> {
  late final List<Bubble> _specs;

  @override
  void initState() {
    super.initState();
    final rnd = math.Random(7);
    _specs = List<Bubble>.generate(9, (_) {
      return Bubble(
        x: rnd.nextDouble(),
        radius: 2.0 + rnd.nextDouble() * 4.0,
        speed: 0.6 + rnd.nextDouble() * 0.9,
        phase: rnd.nextDouble(),
        amp: 6.0 + rnd.nextDouble() * 10.0,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        const DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Color(0xFF1E5FA0), Color(0xFF0A3665)],
            ),
          ),
        ),
        RepaintBoundary(child: CustomPaint(painter: _WavesPainter())),
        RepaintBoundary(
          child: AnimatedBuilder(
            animation: widget.bubbles,
            builder: (context, _) => CustomPaint(
              painter: _BubblesPainter(widget.bubbles.value, _specs),
            ),
          ),
        ),
      ],
    );
  }
}

// =============================================================================
//  Fondo: dos ondas Bezier semitransparentes abajo
// =============================================================================
class _WavesPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;

    final wave1 = Path()
      ..moveTo(0, h * 0.82)
      ..cubicTo(w * 0.25, h * 0.76, w * 0.55, h * 0.90, w, h * 0.80)
      ..lineTo(w, h)
      ..lineTo(0, h)
      ..close();
    canvas.drawPath(
      wave1,
      Paint()..color = const Color(0xFF07284A).withValues(alpha: 0.35),
    );

    final wave2 = Path()
      ..moveTo(0, h * 0.89)
      ..cubicTo(w * 0.30, h * 0.83, w * 0.62, h * 0.98, w, h * 0.88)
      ..lineTo(w, h)
      ..lineTo(0, h)
      ..close();
    canvas.drawPath(
      wave2,
      Paint()..color = const Color(0xFF05203C).withValues(alpha: 0.45),
    );
  }

  @override
  bool shouldRepaint(_WavesPainter oldDelegate) => false;
}

// =============================================================================
//  Burbujas ambientales que suben en loop
// =============================================================================
class Bubble {
  const Bubble({
    required this.x,
    required this.radius,
    required this.speed,
    required this.phase,
    required this.amp,
  });

  final double x; // 0..1 (fracción del ancho)
  final double radius;
  final double speed;
  final double phase;
  final double amp; // amplitud de la oscilación horizontal
}

class _BubblesPainter extends CustomPainter {
  _BubblesPainter(this.t, this.bubbles);

  final double t; // 0..1 en bucle
  final List<Bubble> bubbles;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = Colors.white.withValues(alpha: 0.28);

    for (final b in bubbles) {
      final prog = ((t * b.speed) + b.phase) % 1.0;
      final y = size.height - prog * (size.height + 40) + 20;
      final x =
          b.x * size.width + math.sin(prog * math.pi * 4 + b.phase * 6) * b.amp;
      canvas.drawCircle(Offset(x, y), b.radius, paint);
    }
  }

  @override
  bool shouldRepaint(_BubblesPainter oldDelegate) => oldDelegate.t != t;
}
