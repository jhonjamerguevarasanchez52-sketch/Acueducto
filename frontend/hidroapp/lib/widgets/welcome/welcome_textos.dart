import 'package:flutter/material.dart';

import 'welcome_common.dart';

/// El bloque de texto del splash: la sombra en el suelo, las siglas del
/// proyecto ("HA") que entran letra a letra y, al final, el nombre de la app y
/// los datos del acueducto.
class WelcomeTextos extends StatelessWidget {
  const WelcomeTextos({
    super.key,
    required this.phase,
    required this.shortName,
    required this.appName,
    required this.vereda,
    required this.sector,
    required this.pais,
  });

  final EnsamblePhase phase;
  final String shortName;
  final String appName;
  final String vereda;
  final String sector;
  final String pais;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        _groundShadow(),
        const SizedBox(height: 6),
        _ha(),
        const SizedBox(height: 14),
        _texts(),
      ],
    );
  }

  Widget _groundShadow() {
    final o = kHaShadowInt.transform(phase.t);
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

  Widget _ha() {
    final t = kHaLettersInt.transform(phase.t);
    final off = 1.0 - t;
    final letterOpacity = phase.win(0.74, 0.86).clamp(0.0, 1.0);
    final ch = shortName.padRight(2, ' ');

    Widget letter(String c, bool fromLeft) {
      final sign = fromLeft ? -1.0 : 1.0;
      return Opacity(
        opacity: letterOpacity,
        child: Transform.translate(
          offset: Offset(sign * 90 * off, 0),
          child: Transform(
            alignment: Alignment.center,
            transform: welcomePerspective(sign * 1.1 * off),
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
            opacity: (phase.flash(kHaFlashA, kHaFlashB) * 0.35).clamp(0.0, 1.0),
            child: Container(
              width: 96,
              height: 48,
              decoration: kWelcomeRadialWhite,
            ),
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

  Widget _texts() {
    final o = kTextFadeInt.transform(phase.t).clamp(0.0, 1.0);
    return Opacity(
      opacity: o,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            appName,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 15,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            '$vereda · $sector',
            style: const TextStyle(color: Color(0xFFB5D4F4), fontSize: 13),
          ),
          const SizedBox(height: 3),
          Text(
            pais,
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
}
