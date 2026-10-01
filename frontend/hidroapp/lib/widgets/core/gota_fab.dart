import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../theme/app_theme.dart';

/// Frases cortas que GOTA muestra de vez en cuando en su burbuja de texto,
/// para darle personalidad al asistente sin ser invasivo.
const _frasesGota = [
  '¡Hola!! 👋 yo te ayudo!!! 💪',
  'Hoy es un buen día ☀️😄',
  '¡Soy Gota! 💧😊',
  '¿Tienes una fuga? 😱 ¡Repórtala aquí! 🔧',
  'Cuidemos cada gota de agua 💧🌎',
  '¿En qué te ayudo hoy? 🤔✨',
  '¡Pssst! Toca aquí si me necesitas 👇😉',
  '¿Ya pagaste tu factura? 🧾💸',
];

/// Botón flotante que abre el chat con el asistente "GOTA". Muestra la mascota
/// (`assets/images/gota_mascota.png`) dentro de un círculo con una animación
/// suave de flotación, y de vez en cuando una burbuja de texto con una frase
/// corta. Si el asset no está disponible, cae a un icono de gota para no
/// romper la pantalla.
class GotaFab extends StatefulWidget {
  const GotaFab({super.key, required this.onTap});

  final VoidCallback onTap;

  @override
  State<GotaFab> createState() => _GotaFabState();
}

class _GotaFabState extends State<GotaFab>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _flotar;
  final _random = Random();
  Timer? _timerBurbuja;
  String _frase = _frasesGota.first;
  bool _mostrarBurbuja = false;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat(reverse: true);

    _flotar = Tween<double>(begin: 0, end: -6).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );

    _programarProximaBurbuja(inicial: true);
  }

  // Programa la siguiente aparición de la burbuja tras una espera aleatoria,
  // para que no se sienta mecánica ni se repita siempre en el mismo momento.
  void _programarProximaBurbuja({bool inicial = false}) {
    final espera = inicial
        ? Duration(seconds: 1 + _random.nextInt(2))
        : Duration(seconds: 5 + _random.nextInt(5));
    _timerBurbuja = Timer(espera, _activarBurbuja);
  }

  void _activarBurbuja() {
    if (!mounted) return;
    setState(() {
      _frase = _frasesGota[_random.nextInt(_frasesGota.length)];
      _mostrarBurbuja = true;
    });
    _timerBurbuja = Timer(const Duration(seconds: 3), _ocultarBurbuja);
  }

  void _ocultarBurbuja() {
    if (!mounted) return;
    setState(() => _mostrarBurbuja = false);
    _programarProximaBurbuja();
  }

  @override
  void dispose() {
    _timerBurbuja?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      alignment: Alignment.bottomRight,
      children: [
        Positioned(
          right: 0,
          bottom: 82,
          child: IgnorePointer(
            ignoring: !_mostrarBurbuja,
            child: AnimatedOpacity(
              opacity: _mostrarBurbuja ? 1 : 0,
              duration: const Duration(milliseconds: 250),
              child: GestureDetector(
                onTap: widget.onTap,
                child: _BurbujaTexto(texto: _frase),
              ),
            ),
          ),
        ),
        GestureDetector(
          onTap: widget.onTap,
          child: AnimatedBuilder(
            animation: _flotar,
            builder: (context, child) => Transform.translate(
              offset: Offset(0, _flotar.value),
              child: child,
            ),
            child: Container(
              width: 68,
              height: 68,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppTheme.surfaceTint,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.25),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              // ClipOval recorta la imagen al círculo del botón (la imagen es
              // casi cuadrada, así que sin esto se saldría del borde) y
              // BoxFit.cover hace que la mascota llene todo el círculo en vez
              // de quedar pequeña con margen alrededor.
              child: ClipOval(
                child: Image.asset(
                  'assets/images/gota_mascota.png',
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) => const Icon(
                    Icons.water_drop,
                    color: AppTheme.primary,
                    size: 34,
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _BurbujaTexto extends StatelessWidget {
  const _BurbujaTexto({required this.texto});

  final String texto;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          constraints: const BoxConstraints(maxWidth: 190),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.18),
                blurRadius: 10,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          child: Text(
            texto,
            style: GoogleFonts.fredoka(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: AppTheme.primaryDark,
              height: 1.25,
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(right: 22),
          child: Transform.rotate(
            angle: 0.78539816339, // 45°, forma la "colita" del globo
            child: Container(
              width: 12,
              height: 12,
              decoration: const BoxDecoration(color: Colors.white),
            ),
          ),
        ),
      ],
    );
  }
}
