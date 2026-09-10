import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../providers/auth_provider.dart';
import '../../screens/verificar_cuenta_screen.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import 'auth_style.dart';

/// Tarjeta blanca con el formulario de inicio de sesión: correo, contraseña y
/// el botón de entrar. Conserva su propio estado (controllers, validación y la
/// llamada a `AuthProvider.login`); si la cuenta no está verificada, abre la
/// pantalla de verificación.
class LoginForm extends StatefulWidget {
  const LoginForm({super.key});

  @override
  State<LoginForm> createState() => _LoginFormState();
}

class _LoginFormState extends State<LoginForm> {
  static final _correoValido = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');

  final _formKey = GlobalKey<FormState>();
  final _correoCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  bool _cargando = false;
  bool _verPassword = false;

  @override
  void dispose() {
    _correoCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  Future<void> _entrar() async {
    if (!_formKey.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() => _cargando = true);
    try {
      await context.read<AuthProvider>().login(
            _correoCtrl.text,
            _passwordCtrl.text,
          );
      // AuthGate observa el AuthProvider y esta misma ruta se reconstruye
      // como HomeScreen al quedar autenticado: no hay nada que "pop-ear".
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.requiereVerificacion) {
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => VerificarCuentaScreen(
              correo: _correoCtrl.text.trim(),
              password: _passwordCtrl.text,
            ),
          ),
        );
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message)),
      );
    } finally {
      if (mounted) setState(() => _cargando = false);
    }
  }

  void _recuperarPassword() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text(
          'Para restablecer tu contraseña, contacta al administrador del acueducto.',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final onSurface = Theme.of(context).colorScheme.onSurface;

    return AuthCard(
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Bienvenido/a',
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w700,
                color: onSurface,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'Ingresa con tu correo y contraseña',
              style: TextStyle(fontSize: 13.5, color: authMuted),
            ),
            const SizedBox(height: 22),
            authFieldLabel('CORREO ELECTRÓNICO'),
            TextFormField(
              controller: _correoCtrl,
              keyboardType: TextInputType.emailAddress,
              autocorrect: false,
              textInputAction: TextInputAction.next,
              decoration: authInputDecoration(
                hint: 'tucorreo@ejemplo.com',
                icon: Icons.mail_outline,
              ),
              validator: (v) {
                final t = v?.trim() ?? '';
                if (t.isEmpty) return 'Ingresa tu correo';
                if (!_correoValido.hasMatch(t)) {
                  return 'Correo no válido';
                }
                return null;
              },
            ),
            const SizedBox(height: 16),
            authFieldLabel('CONTRASEÑA'),
            TextFormField(
              controller: _passwordCtrl,
              obscureText: !_verPassword,
              textInputAction: TextInputAction.done,
              onFieldSubmitted: (_) => _cargando ? null : _entrar(),
              decoration: authInputDecoration(
                hint: '••••••••',
                icon: Icons.lock_outline,
                suffix: IconButton(
                  splashRadius: 20,
                  icon: Icon(
                    _verPassword
                        ? Icons.visibility_off_outlined
                        : Icons.visibility_outlined,
                    color: authMuted,
                    size: 20,
                  ),
                  onPressed: () =>
                      setState(() => _verPassword = !_verPassword),
                ),
              ),
              validator: (v) =>
                  (v == null || v.isEmpty) ? 'Ingresa tu contraseña' : null,
            ),
            const SizedBox(height: 6),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: _recuperarPassword,
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  foregroundColor: AppTheme.primary,
                  textStyle: const TextStyle(
                      fontSize: 13, fontWeight: FontWeight.w600),
                ),
                child: const Text('¿Olvidaste tu contraseña?'),
              ),
            ),
            const SizedBox(height: 14),
            FilledButton(
              onPressed: _cargando ? null : _entrar,
              child: _cargando
                  ? const SizedBox(
                      height: 22,
                      width: 22,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Ingresar al sistema'),
            ),
          ],
        ),
      ),
    );
  }
}
