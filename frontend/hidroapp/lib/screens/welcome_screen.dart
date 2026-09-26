import 'package:flutter/material.dart';

import '../widgets/welcome/welcome.dart';

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
  late final AnimationController _bubbles; // burbujas de fondo (desde el inicio)

  late final Animation<double> _dropShake; // vibración al cerrar la gota

  bool _assembled = false;
  bool _navego = false;
  double _fgOpacity = 1.0; // logo + texto se desvanecen antes de navegar

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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A3665),
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Fondo estático (gradiente + ondas) + burbujas animadas, aisladas.
          WelcomeBackground(bubbles: _bubbles),

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
                            builder: (context, _) => SizedBox(
                              width: 220,
                              height: 220,
                              child: Stack(
                                alignment: Alignment.center,
                                children: [
                                  WelcomeRing(
                                    phase: EnsamblePhase(_main.value),
                                    ringIdle: _ringIdle.value,
                                    assembled: _assembled,
                                  ),
                                  WelcomeDrop(
                                    phase: EnsamblePhase(_main.value),
                                    dropIdle: _dropIdle.value,
                                    assembled: _assembled,
                                    dropShake: _dropShake.value,
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 20),
                        // Texto: solo depende del ensamble; deja de
                        // reconstruirse cuando este termina.
                        RepaintBoundary(
                          child: AnimatedBuilder(
                            animation: _main,
                            builder: (context, _) => WelcomeTextos(
                              phase: EnsamblePhase(_main.value),
                              shortName: widget.shortName,
                              appName: widget.appName,
                              vereda: widget.vereda,
                              sector: widget.sector,
                              pais: widget.pais,
                            ),
                          ),
                        ),
                        const SizedBox(height: 22),
                        RepaintBoundary(
                          child: AnimatedBuilder(
                            animation: Listenable.merge([_main, _bubbles]),
                            builder: (context, _) => WelcomeLoadingDots(
                              mainValue: _main.value,
                              bubblesValue: _bubbles.value,
                            ),
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
}
