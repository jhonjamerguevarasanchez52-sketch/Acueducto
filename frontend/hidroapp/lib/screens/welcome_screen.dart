import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../widgets/hidro_logo.dart';

/// Pantalla de bienvenida animada (splash) de HIDRO-APP.
///
/// El logo —un anillo con 4 puntos cardinales y, dentro, una gota con una
/// flecha de "enviar ubicación"— se ensambla como dos placas metálicas que
/// se cierran en 3D, con iluminaciones atenuadas para un look sobrio. Al
/// terminar, tras [holdBeforeNavigate], navega con `pushReplacement` +
/// fade hacia [nextRoute].
///
/// Todo con Flutter puro (AnimationController, TweenSequence, CustomPainter,
/// Matrix4 con perspectiva). No requiere paquetes nuevos.
///
/// Rendimiento: el fondo (gradiente + ondas) es estático y queda fuera de
/// las animaciones; las burbujas, el logo, el texto y los puntos de carga
/// tienen cada uno su propio [AnimatedBuilder] dentro de un
/// [RepaintBoundary], para no repintar toda la pantalla en cada frame.
class WelcomeScreen extends StatefulWidget {
  const WelcomeScreen({
    super.key,
    required this.nextRoute,
    this.assembleDuration = const Duration(milliseconds: 3800),
    this.holdBeforeNavigate = const Duration(milliseconds: 900),
    this.shortName = 'HA',
    this.appName = 'HIDRO-APP',
    this.vereda = 'Vereda Majo',
    this.sector = 'Sector Campo Amor',
    this.pais = 'Colombia',
  });

  /// Pantalla a la que se navega al completar la animación.
  final Widget nextRoute;

  /// Duración del ensamble completo (controla todas las fases por Interval).
  final Duration assembleDuration;

  /// Espera tras el ensamble antes de navegar (anillo girando, gota flotando).
  final Duration holdBeforeNavigate;

  final String shortName;
  final String appName;
  final String vereda;
  final String sector;
  final String pais;

  @override
  State<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends State<WelcomeScreen>
    with TickerProviderStateMixin {
  // --- Controller principal: maneja todo el ensamble vía Interval + Curve ---
  late final AnimationController _main;

  // --- Controllers en bucle (arrancan solo cuando corresponde) ---
  late final AnimationController _ringIdle; // giro 3D del anillo, 7 s / vuelta
  late final AnimationController _dropIdle; // flotado de la gota, 2.2 s
  late final AnimationController
  _bubbles; // burbujas de fondo (desde el inicio)

  late final Animation<double> _dropShake; // vibración al cerrar la gota

  bool _assembled = false;
  bool _navego = false;
  double _fgOpacity = 1.0; // logo + texto se desvanecen antes de navegar

  late final List<_Bubble> _bubbleSpecs;

  // ---------------------------------------------------------------------------
  //  Fases del ensamble (fracciones de assembleDuration)
  // ---------------------------------------------------------------------------
  static const Interval _ringHalvesInt = Interval(
    0.00,
    0.22,
    curve: Curves.easeOutBack,
  );
  static const double _ringFlashA = 0.18, _ringFlashB = 0.34;
  static const double _ringDotStart = 0.16,
      _ringDotStep = 0.02,
      _ringDotLen = 0.10;

  static const Interval _dropHalvesInt = Interval(
    0.30,
    0.54,
    curve: Curves.easeOutBack,
  );
  static const double _dropFlashA = 0.50, _dropFlashB = 0.60;
  static const Interval _arrowInt = Interval(0.56, 0.72, curve: Curves.easeOut);
  static const double _dropBubStart = 0.68,
      _dropBubStep = 0.07,
      _dropBubLen = 0.10;

  static const Interval _haShadowInt = Interval(0.58, 0.70);
  static const Interval _haLettersInt = Interval(
    0.74,
    0.90,
    curve: Curves.easeOutBack,
  );
  static const double _haFlashA = 0.74, _haFlashB = 0.90;
  static const Interval _textFadeInt = Interval(0.90, 1.00);

  @override
  void initState() {
    super.initState();

    _main = AnimationController(vsync: this, duration: widget.assembleDuration);
    _ringIdle = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 7),
    );
    _dropIdle = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2200),
    );
    _bubbles = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 8),
    )..repeat();

    _dropShake =
        TweenSequence<double>([
          TweenSequenceItem(tween: Tween(begin: 0.0, end: 8.0), weight: 1),
          TweenSequenceItem(tween: Tween(begin: 8.0, end: -6.0), weight: 1),
          TweenSequenceItem(tween: Tween(begin: -6.0, end: 4.0), weight: 1),
          TweenSequenceItem(tween: Tween(begin: 4.0, end: 0.0), weight: 1),
        ]).animate(
          CurvedAnimation(parent: _main, curve: const Interval(0.52, 0.60)),
        );

    final rnd = math.Random(7);
    _bubbleSpecs = List<_Bubble>.generate(9, (_) {
      return _Bubble(
        x: rnd.nextDouble(),
        radius: 2.0 + rnd.nextDouble() * 4.0,
        speed: 0.6 + rnd.nextDouble() * 0.9,
        phase: rnd.nextDouble(),
        amp: 6.0 + rnd.nextDouble() * 10.0,
      );
    });

    _main.addStatusListener((status) {
      if (status == AnimationStatus.completed) _alTerminarEnsamble();
    });
    _main.forward();
  }

  Future<void> _alTerminarEnsamble() async {
    if (!mounted || _navego) return;
    setState(() => _assembled = true);
    _ringIdle.repeat();
    _dropIdle.repeat();

    await Future<void>.delayed(widget.holdBeforeNavigate);
    if (!mounted || _navego) return;

    // El logo y el texto se desvanecen dejando solo el fondo azul —el mismo
    // gradiente que la cabecera del login—, para que la transición no tenga
    // un corte brusco.
    setState(() => _fgOpacity = 0.0);
    await Future<void>.delayed(const Duration(milliseconds: 420));
    if (!mounted || _navego) return;
    _navego = true;

    Navigator.of(context).pushReplacement(
      PageRouteBuilder<void>(
        transitionDuration: const Duration(milliseconds: 650),
        pageBuilder: (context, animation, secondary) => widget.nextRoute,
        transitionsBuilder: (context, animation, secondary, child) =>
            FadeTransition(
              opacity: CurvedAnimation(
                parent: animation,
                curve: Curves.easeInOutCubic,
              ),
              child: child,
            ),
      ),
    );
  }

  @override
  void dispose() {
    _main.dispose();
    _ringIdle.dispose();
    _dropIdle.dispose();
    _bubbles.dispose();
    super.dispose();
  }

  // ---------------------------------------------------------------------------
  //  Helpers de fase
  // ---------------------------------------------------------------------------

  double _win(double a, double b, [Curve curve = Curves.linear]) {
    final t = ((_main.value - a) / (b - a)).clamp(0.0, 1.0);
    return curve.transform(t);
  }

  /// Pulso 0 → 1 → 0 dentro de la ventana [a, b] (para los destellos).
  double _flash(double a, double b) {
    final t = ((_main.value - a) / (b - a)).clamp(0.0, 1.0);
    return math.sin(t * math.pi);
  }

  static const BoxDecoration _radialWhite = BoxDecoration(
    shape: BoxShape.circle,
    gradient: RadialGradient(colors: [Colors.white, Color(0x00FFFFFF)]),
  );

  Matrix4 _perspective(double angleY, [double angleX = 0]) => Matrix4.identity()
    ..setEntry(3, 2, 0.0016)
    ..rotateX(angleX)
    ..rotateY(angleY);

  // ---------------------------------------------------------------------------
  //  Build
  // ---------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A3665),
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Fondo estático: nunca se reconstruye con las animaciones.
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

          // Burbujas: su propio AnimatedBuilder, aislado en una capa.
          RepaintBoundary(
            child: AnimatedBuilder(
              animation: _bubbles,
              builder: (context, _) => CustomPaint(
                painter: _BubblesPainter(_bubbles.value, _bubbleSpecs),
              ),
            ),
          ),

          SafeArea(
            child: Center(
              child: AnimatedOpacity(
                opacity: _fgOpacity,
                duration: const Duration(milliseconds: 420),
                curve: Curves.easeInOut,
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Logo: ensamble + giros idle.
                        RepaintBoundary(
                          child: AnimatedBuilder(
                            animation: Listenable.merge([
                              _main,
                              _ringIdle,
                              _dropIdle,
                            ]),
                            builder: (context, _) => _buildLogo(),
                          ),
                        ),
                        const SizedBox(height: 20),
                        // Texto: solo depende del ensamble; deja de
                        // reconstruirse cuando este termina.
                        RepaintBoundary(
                          child: AnimatedBuilder(
                            animation: _main,
                            builder: (context, _) => Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                _buildGroundShadow(),
                                const SizedBox(height: 6),
                                _buildHA(),
                                const SizedBox(height: 14),
                                _buildTexts(),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 22),
                        RepaintBoundary(
                          child: AnimatedBuilder(
                            animation: Listenable.merge([_main, _bubbles]),
                            builder: (context, _) => _buildLoadingDots(),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // --- Logo (anillo + gota) --------------------------------------------------

  Widget _buildLogo() {
    return SizedBox(
      width: 220,
      height: 220,
      child: Stack(
        alignment: Alignment.center,
        children: [_buildRing(), _buildDrop()],
      ),
    );
  }

  Widget _buildRing() {
    final tHalves = _ringHalvesInt.transform(_main.value);
    final off = 1.0 - tHalves;
    final dx = 190.0 * off;
    final ang = 1.5 * off;
    final opacity = _win(0.02, 0.14).clamp(0.0, 1.0);
    final idleAngle = _assembled ? _ringIdle.value * 2 * math.pi : 0.0;

    Widget half(bool left) => RepaintBoundary(
      child: ClipRect(
        clipper: _HalfClipper(left: left),
        child: CustomPaint(
          size: const Size(170, 170),
          painter: HidroRingPainter(),
        ),
      ),
    );

    final assembled = Stack(
      alignment: Alignment.center,
      children: [
        Opacity(
          opacity: opacity,
          child: Transform.translate(
            offset: Offset(-dx, 0),
            child: Transform(
              alignment: Alignment.center,
              transform: _perspective(-ang),
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
              transform: _perspective(ang),
              child: half(false),
            ),
          ),
        ),
        Opacity(
          opacity: (_flash(_ringFlashA, _ringFlashB) * 0.35).clamp(0.0, 1.0),
          child: Container(width: 150, height: 150, decoration: _radialWhite),
        ),
        ..._buildRingDots(),
      ],
    );

    return Transform(
      alignment: Alignment.center,
      transform: _perspective(idleAngle),
      child: assembled,
    );
  }

  List<Widget> _buildRingDots() {
    const positions = <double>[
      -math.pi / 2, // N
      0.0, // E
      math.pi / 2, // S
      math.pi, // W
    ];
    const ringRadius = 83.0;

    return List<Widget>.generate(4, (i) {
      final start = _ringDotStart + i * _ringDotStep;
      final s = _win(start, start + _ringDotLen, Curves.elasticOut);
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

  Widget _buildDrop() {
    final tHalves = _dropHalvesInt.transform(_main.value);
    final off = 1.0 - tHalves;
    final dx = 120.0 * off;
    final ang = 1.6 * off;
    final opacity = _win(0.30, 0.40).clamp(0.0, 1.0);

    final shake = _dropShake.value;
    final floatDy = _assembled
        ? math.sin(_dropIdle.value * 2 * math.pi) * 6.0
        : 0.0;
    final floatRot = _assembled
        ? math.sin(_dropIdle.value * 2 * math.pi) * 0.08
        : 0.0;

    Widget half(bool left) => RepaintBoundary(
      child: ClipRect(
        clipper: _HalfClipper(left: left),
        child: CustomPaint(
          size: const Size(100, 110),
          painter: HidroDropPainter(),
        ),
      ),
    );

    return Transform.translate(
      offset: Offset(shake, floatDy),
      child: Transform(
        alignment: Alignment.center,
        transform: _perspective(floatRot),
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
                    transform: _perspective(-ang),
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
                    transform: _perspective(ang),
                    child: half(false),
                  ),
                ),
              ),
              Opacity(
                opacity: (_flash(_dropFlashA, _dropFlashB) * 0.4).clamp(
                  0.0,
                  1.0,
                ),
                child: Container(
                  width: 92,
                  height: 92,
                  decoration: _radialWhite,
                ),
              ),
              _buildArrow(),
              ..._buildDropBubbles(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildArrow() {
    final t = _arrowInt.transform(_main.value);
    final ang = 1.2 * (1.0 - t);
    return Transform.translate(
      offset: const Offset(0, 6),
      child: Opacity(
        opacity: t.clamp(0.0, 1.0),
        child: Transform(
          alignment: Alignment.center,
          transform: _perspective(0, ang),
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

  List<Widget> _buildDropBubbles() {
    const positions = <Offset>[Offset(-14, 8), Offset(11, -2), Offset(3, 22)];
    const sizes = <double>[7, 5, 6];

    return List<Widget>.generate(3, (i) {
      final start = _dropBubStart + i * _dropBubStep;
      final s = _win(start, start + _dropBubLen, Curves.elasticOut);
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

  // --- Texto "HA" y datos --------------------------------------------------

  Widget _buildGroundShadow() {
    final o = _haShadowInt.transform(_main.value);
    return Opacity(
      opacity: (o * 0.28).clamp(0.0, 1.0),
      child: Container(
        width: 130,
        height: 24,
        decoration: const BoxDecoration(
          borderRadius: BorderRadius.all(Radius.elliptical(65, 12)),
          gradient: RadialGradient(colors: [Colors.black, Color(0x00000000)]),
        ),
      ),
    );
  }

  Widget _buildHA() {
    final t = _haLettersInt.transform(_main.value);
    final off = 1.0 - t;
    final letterOpacity = _win(0.74, 0.86).clamp(0.0, 1.0);
    final ch = widget.shortName.padRight(2, ' ');

    Widget letter(String c, bool fromLeft) {
      final sign = fromLeft ? -1.0 : 1.0;
      return Opacity(
        opacity: letterOpacity,
        child: Transform.translate(
          offset: Offset(sign * 90 * off, 0),
          child: Transform(
            alignment: Alignment.center,
            transform: _perspective(sign * 1.1 * off),
            child: ShaderMask(
              shaderCallback: (rect) => const LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Color(0xFFDCEFF5),
                  Color(0xFF7FE3F5),
                  Color(0xFF2FA5C9),
                ],
              ).createShader(rect),
              child: Text(
                c,
                style: const TextStyle(
                  fontSize: 42,
                  fontWeight: FontWeight.w600,
                  color: Colors.white,
                  height: 1.0,
                ),
              ),
            ),
          ),
        ),
      );
    }

    return SizedBox(
      height: 54,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Opacity(
            opacity: (_flash(_haFlashA, _haFlashB) * 0.35).clamp(0.0, 1.0),
            child: Container(width: 96, height: 48, decoration: _radialWhite),
          ),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              letter(ch[0], true),
              const SizedBox(width: 2),
              letter(ch[1].trim().isEmpty ? 'A' : ch[1], false),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTexts() {
    final o = _textFadeInt.transform(_main.value).clamp(0.0, 1.0);
    return Opacity(
      opacity: o,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            widget.appName,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 15,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            '${widget.vereda} · ${widget.sector}',
            style: const TextStyle(color: Color(0xFFB5D4F4), fontSize: 13),
          ),
          const SizedBox(height: 3),
          Text(
            widget.pais,
            style: const TextStyle(
              color: Color(0xFF85B7EB),
              fontSize: 11,
              letterSpacing: 1,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLoadingDots() {
    final visible = _main.value >= 0.98;
    return AnimatedOpacity(
      duration: const Duration(milliseconds: 300),
      opacity: visible ? 1 : 0,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: List<Widget>.generate(3, (i) {
          final v =
              0.5 +
              0.5 *
                  math.sin(
                    _bubbles.value * 2 * math.pi * 3 - i * (2 * math.pi / 3),
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

// =============================================================================
//  Recorte por mitades (para el efecto "dos placas")
// =============================================================================
class _HalfClipper extends CustomClipper<Rect> {
  _HalfClipper({required this.left});

  final bool left;

  @override
  Rect getClip(Size size) => left
      ? Rect.fromLTWH(0, 0, size.width / 2, size.height)
      : Rect.fromLTWH(size.width / 2, 0, size.width / 2, size.height);

  @override
  bool shouldReclip(_HalfClipper oldClipper) => oldClipper.left != left;
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
class _Bubble {
  const _Bubble({
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
  final List<_Bubble> bubbles;

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
