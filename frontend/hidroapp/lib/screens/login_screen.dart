import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../widgets/auth/auth.dart';
import '../widgets/core/hidro_logo.dart';

/// Pantalla de inicio de sesión de HIDRO-APP.
///
/// Cabecera azul con el logo y los datos del acueducto, y una tarjeta blanca
/// con el formulario. Las cuentas las crea el administrador: no hay
/// auto-registro.
class LoginScreen extends StatelessWidget {
  const LoginScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: const Color(0xFFF4F8FB),
        body: SingleChildScrollView(
          child: Column(
            children: [
              const AuthHeader(child: _Encabezado()),
              Transform.translate(
                offset: const Offset(0, -28),
                child: const Padding(
                  padding: EdgeInsets.fromLTRB(20, 0, 20, 12),
                  child: Column(
                    children: [
                      LoginForm(),
                      SizedBox(height: 18),
                      Text(
                        '¿Sin cuenta? Solicítala al administrador del acueducto.',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 12, color: authMuted),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Encabezado extends StatelessWidget {
  const _Encabezado();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const HidroLogo(size: 82),
        const SizedBox(height: 16),
        const Text(
          'HIDROAPP',
          style: TextStyle(
            color: Colors.white,
            fontSize: 30,
            fontWeight: FontWeight.w800,
            letterSpacing: 1.5,
          ),
        ),
        const SizedBox(height: 6),
        const Text(
          'Acueducto Veredal · Campo Amor',
          style: TextStyle(
            color: Colors.white,
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 3),
        Text(
          'Garzón, Huila, Colombia',
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.75),
            fontSize: 12,
          ),
        ),
      ],
    );
  }
}
