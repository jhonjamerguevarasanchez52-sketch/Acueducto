import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Logo estático de HIDRO-APP: un anillo con 4 puntos cardinales y, dentro,
/// una gota de agua con la flecha de "enviar ubicación".
///
/// Con [withBadge] se dibuja dentro de una placa redondeada estilo ícono de
/// app, con las siglas del proyecto abajo. La versión animada (el ensamble de
/// dos placas) vive en `welcome_screen.dart`; este widget es la forma fija,
/// reutilizable en cabeceras y otras pantallas.
class HidroLogo extends StatelessWidget {
  const HidroLogo({
    super.key,
    this.size = 96,
    this.withBadge = true,
    this.shortName = 'HA',
  });

  final double size;
  final bool withBadge;
  final String shortName;

  @override
  Widget build(BuildContext context) {
    final ring = size * (withBadge ? 0.58 : 0.92);
    final dropW = ring * 0.52;
    final dropH = dropW * 1.1;
    final arrow = dropW * 0.42;
    final dotSize = ring * 0.11;
    final dotRadius = ring / 2;
    const angles = <double>[-math.pi / 2, 0, math.pi / 2, math.pi];

    final emblem = SizedBox(
      width: size,
      height: withBadge ? size * 0.86 : size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          CustomPaint(size: Size.square(ring), painter: HidroRingPainter()),
          for (var i = 0; i < 4; i++)
            Transform.translate(
              offset: Offset(
                math.cos(angles[i]) * dotRadius,
                math.sin(angles[i]) * dotRadius,
              ),
              child: _CardinalDot(size: dotSize),
            ),
          CustomPaint(size: Size(dropW, dropH), painter: HidroDropPainter()),
          Transform.translate(
            offset: Offset(0, dropH * 0.03),
            child: CustomPaint(
              size: Size.square(arrow),
              painter: HidroArrowPainter(),
            ),
          ),
        ],
      ),
    );

    if (!withBadge) return emblem;

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(size * 0.26),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppTheme.midBlue, AppTheme.deepBlue],
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.28),
            blurRadius: 18,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Stack(
        alignment: Alignment.center,
        children: [
          Padding(
            padding: EdgeInsets.only(bottom: size * 0.08),
            child: emblem,
          ),
          Positioned(
            bottom: size * 0.08,
            child: Text(
              shortName,
              style: TextStyle(
                fontSize: size * 0.15,
                fontWeight: FontWeight.w700,
                color: Colors.white.withValues(alpha: 0.95),
                letterSpacing: size * 0.012,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CardinalDot extends StatelessWidget {
  const _CardinalDot({required this.size});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: const RadialGradient(
          colors: [Color(0xFFC7E9F2), Color(0xFF3FB8D8), Color(0xFF0C6F8F)],
        ),
        border: Border.all(
          color: Colors.white.withValues(alpha: 0.9),
          width: 1.2,
        ),
      ),
    );
  }
}

// =============================================================================
//  Painters compartidos (los usa también el splash animado)
// =============================================================================

/// Anillo: círculo con stroke degradado diagonal.
class HidroRingPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4
      ..shader = const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [Color(0xFFDCEFF5), Color(0xFF6FB8DA), Color(0xFF215C8C)],
      ).createShader(rect);

    final r = (size.shortestSide - 4) / 2;
    canvas.drawCircle(size.center(Offset.zero), r, paint);
  }

  @override
  bool shouldRepaint(HidroRingPainter oldDelegate) => false;
}

/// Gota de agua dibujada a mano.
class HidroDropPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;

    final drop = Path()
      ..moveTo(w * 0.5, 0)
      ..cubicTo(w * 0.95, h * 0.28, w, h * 0.55, w, h * 0.64)
      ..arcToPoint(Offset(w * 0.5, h),
          radius: Radius.circular(w * 0.52), clockwise: true)
      ..arcToPoint(Offset(0, h * 0.64),
          radius: Radius.circular(w * 0.52), clockwise: true)
      ..cubicTo(0, h * 0.55, w * 0.05, h * 0.28, w * 0.5, 0)
      ..close();

    // Sombra de contacto (muy sutil, sin glow).
    canvas.drawOval(
      Rect.fromCenter(
          center: Offset(w * 0.5, h), width: w * 0.66, height: h * 0.12),
      Paint()
        ..color = Colors.black.withValues(alpha: 0.16)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 5),
    );

    // Relleno degradado diagonal.
    canvas.drawPath(
      drop,
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFFDCEFF5), Color(0xFF5FA9D6), Color(0xFF23578F)],
        ).createShader(Offset.zero & size),
    );

    // Contorno blanco suave.
    canvas.drawPath(
      drop,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.6
        ..color = Colors.white.withValues(alpha: 0.55),
    );

    canvas.save();
    canvas.clipPath(drop);

    // "Ola" translúcida en la base interior.
    final wave = Path()
      ..moveTo(0, h * 0.72)
      ..quadraticBezierTo(w * 0.25, h * 0.66, w * 0.5, h * 0.72)
      ..quadraticBezierTo(w * 0.75, h * 0.78, w, h * 0.72)
      ..lineTo(w, h)
      ..lineTo(0, h)
      ..close();
    canvas.drawPath(wave, Paint()..color = Colors.white.withValues(alpha: 0.14));

    // Brillo diagonal tipo reflejo de vidrio.
    final glint = Path()
      ..moveTo(w * 0.30, h * 0.20)
      ..quadraticBezierTo(w * 0.18, h * 0.40, w * 0.30, h * 0.56)
      ..quadraticBezierTo(w * 0.40, h * 0.38, w * 0.30, h * 0.20)
      ..close();
    canvas.drawPath(glint, Paint()..color = Colors.white.withValues(alpha: 0.20));

    canvas.restore();
  }

  @override
  bool shouldRepaint(HidroDropPainter oldDelegate) => false;
}

/// Flecha "enviar ubicación" dentro de la gota.
class HidroArrowPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final path = Path()
      ..moveTo(w * 0.5, h * 0.06)
      ..lineTo(w * 0.92, h * 0.94)
      ..lineTo(w * 0.5, h * 0.70)
      ..lineTo(w * 0.08, h * 0.94)
      ..close();
    canvas.drawPath(path, Paint()..color = Colors.white);
  }

  @override
  bool shouldRepaint(HidroArrowPainter oldDelegate) => false;
}
