import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme/app_theme.dart';
import '../widgets/auth/auth_style.dart';
import '../widgets/auth/recuperar_password_form.dart';
import '../widgets/core/hidro_logo.dart';

/// Pantalla de recuperación de contraseña, abierta desde el login con
/// "¿Olvidaste tu contraseña?". Primero pide el correo para enviar un código
/// de 6 dígitos y luego permite escribir ese código junto a la nueva
/// contraseña. Al terminar vuelve al login.
class RecuperarPasswordScreen extends StatelessWidget {
  const RecuperarPasswordScreen({super.key, this.correoInicial = ''});

  /// Correo que el usuario ya había escrito en el login, para no repetirlo.
  final String correoInicial;

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: AppTheme.surfaceTint,
        body: SingleChildScrollView(
          child: Column(
            children: [
              const AuthHeader(topExtra: 20, child: _Encabezado()),
              Transform.translate(
                offset: const Offset(0, -28),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
                  child: RecuperarPasswordForm(correoInicial: correoInicial),
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
        Align(
          alignment: Alignment.centerLeft,
          child: IconButton(
            onPressed: () => Navigator.of(context).maybePop(),
            icon: const Icon(Icons.arrow_back, color: Colors.white),
            tooltip: 'Volver',
          ),
        ),
        const HidroLogo(size: 72),
        const SizedBox(height: 14),
        const Text(
          'Recuperar contraseña',
          style: TextStyle(
            color: Colors.white,
            fontSize: 24,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.5,
          ),
        ),
      ],
    );
  }
}
