import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Botón flotante que abre el chat con el asistente "GOTA". Muestra la mascota
/// (`assets/images/gota_mascota.png`) dentro de un círculo con una animación
/// suave de flotación. Si el asset no está disponible, cae a un icono de gota
/// para no romper la pantalla.
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
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
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
          // BoxFit.cover hace que la mascota llene todo el círculo en vez de
          // quedar pequeña con margen alrededor.
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
    );
  }
}
