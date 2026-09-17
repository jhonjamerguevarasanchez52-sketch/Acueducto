import 'package:flutter/material.dart';

import '../../theme/app_theme.dart';

/// Cabecera azul con degradado de la pestaña "Inicio": saludo, bienvenida a
/// HidroApp y un par de etiquetas de estado. Imita la tarjeta superior del
/// diseño.
class HomeCabecera extends StatelessWidget {
  const HomeCabecera({super.key, this.nombre, this.zona});

  final String? nombre;
  final String? zona;

  @override
  Widget build(BuildContext context) {
    final saludo = (nombre != null && nombre!.trim().isNotEmpty)
        ? 'Hola, ${nombre!.trim()} 👋'
        : 'Hola 👋';
    final tieneZona = zona != null && zona!.trim().isNotEmpty;

    return Container(
      width: double.infinity,
      padding: EdgeInsets.fromLTRB(
        20,
        MediaQuery.of(context).padding.top + 24,
        20,
        34,
      ),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppTheme.midBlue, AppTheme.deepBlue],
        ),
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(28),
          bottomRight: Radius.circular(28),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            saludo,
            style: const TextStyle(
              color: AppTheme.skyText,
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'Bienvenido a HidroApp',
            style: TextStyle(
              color: Colors.white,
              fontSize: 26,
              fontWeight: FontWeight.w800,
              height: 1.15,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Tu acueducto veredal, siempre a la mano.',
            style: TextStyle(color: Colors.white70, fontSize: 13.5),
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              const _Etiqueta(texto: 'Servicio activo', conPunto: true),
              if (tieneZona) _Etiqueta(texto: 'Zona ${zona!.trim()}'),
            ],
          ),
        ],
      ),
    );
  }
}

class _Etiqueta extends StatelessWidget {
  const _Etiqueta({required this.texto, this.conPunto = false});

  final String texto;
  final bool conPunto;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (conPunto) ...[
            Container(
              width: 8,
              height: 8,
              decoration: const BoxDecoration(
                color: AppTheme.accent,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 6),
          ],
          Text(
            texto,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
