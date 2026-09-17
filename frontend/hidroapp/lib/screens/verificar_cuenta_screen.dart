import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../widgets/auth/auth_style.dart';
import '../widgets/auth/verificar_form.dart';
import '../widgets/hidro_logo.dart';

/// Pantalla de confirmación de cuenta.
///
/// Al crear una cuenta el backend envía un código de 6 dígitos por correo. El
/// backend no permite iniciar sesión hasta que ese código se confirma aquí. Si
/// el código es válido, la sesión queda iniciada y [AuthGate] muestra el inicio.
class VerificarCuentaScreen extends StatelessWidget {
  const VerificarCuentaScreen({
    super.key,
    required this.correo,
    required this.password,
  });

  final String correo;
  final String password;

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: const Color(0xFFF4F8FB),
        body: SingleChildScrollView(
          child: Column(
            children: [
              AuthHeader(topExtra: 20, child: _Encabezado()),
              Transform.translate(
                offset: const Offset(0, -28),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
                  child: VerificarCuentaForm(
                    correo: correo,
                    password: password,
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
          'Verifica tu cuenta',
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
