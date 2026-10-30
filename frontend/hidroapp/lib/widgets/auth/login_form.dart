import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../providers/auth_provider.dart';
import '../../screens/olvide_password_screen.dart';
import '../../screens/verificar_cuenta_screen.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import '../core/app_snackbar.dart';
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
  bool _habilitarBiometria = false;

  @override
  void initState() {
    super.initState();
    // Al abrir la app con la huella activada, la pedimos de una vez en lugar
    // de esperar a que toquen el botón.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (context.read<AuthProvider>().tomarBiometriaAlIniciar()) {
        _ingresarBiometria();
      }
    });
  }

  Future<void> _ingresarBiometria() async {
    setState(() => _cargando = true);
    try {
      await context.read<AuthProvider>().loginWithBiometrics();
    } on ApiException catch (e) {
      if (mounted) AppSnackbar.error(context, e.message);
    } catch (_) {
      if (mounted) AppSnackbar.error(context, 'No se pudo validar la biometría. Intenta con tu contraseña.');
    } finally {
      if (mounted) setState(() => _cargando = false);
    }
  }

  @override
  void dispose() {
    _correoCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  Future<void> _entrar() async {
    if (!_formKey.currentState!.validate()) return;
    final auth = context.read<AuthProvider>();
    FocusScope.of(context).unfocus();
    setState(() => _cargando = true);
    try {
      await auth.login(
            _correoCtrl.text,
            _passwordCtrl.text,
          );
      if (_habilitarBiometria) {
        await auth.setBiometricEnabled(true);
      }
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
      AppSnackbar.error(context, e.message);
    } finally {
      if (mounted) setState(() => _cargando = false);
    }
  }

  void _recuperarPassword() {
    final correo = _correoCtrl.text.trim();
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => OlvidePasswordScreen(
          // Solo se prellena si lo que escribieron parece un correo.
          correoInicial: _correoValido.hasMatch(correo) ? correo : '',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final onSurface = Theme.of(context).colorScheme.onSurface;
    final auth = context.watch<AuthProvider>();

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
            Text(
              'Ingresa con tu correo y contraseña',
              style: TextStyle(fontSize: 13.5, color: authMutedDe(context)),
            ),
            const SizedBox(height: 22),
            authFieldLabel(context, 'CORREO ELECTRÓNICO'),
            TextFormField(
              controller: _correoCtrl,
              keyboardType: TextInputType.emailAddress,
              autocorrect: false,
              textInputAction: TextInputAction.next,
              decoration: authInputDecoration(
                context,
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
            authFieldLabel(context, 'CONTRASEÑA'),
            TextFormField(
              controller: _passwordCtrl,
              obscureText: !_verPassword,
              textInputAction: TextInputAction.done,
              onFieldSubmitted: (_) => _cargando ? null : _entrar(),
              decoration: authInputDecoration(
                context,
                hint: '••••••••',
                icon: Icons.lock_outline,
                suffix: IconButton(
                  splashRadius: 20,
                  icon: Icon(
                    _verPassword
                        ? Icons.visibility_off_outlined
                        : Icons.visibility_outlined,
                    color: authMutedDe(context),
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
            if (auth.biometricEnabled) ...[
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: _cargando ? null : _ingresarBiometria,
                icon: const Icon(Icons.fingerprint),
                label: const Text('Ingresar con huella o rostro'),
              ),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton(
                  onPressed: _cargando
                      ? null
                      : () => auth.setBiometricEnabled(false),
                  child: const Text('Desactivar acceso biométrico'),
                ),
              ),
            ] else ...[
              FutureBuilder<bool>(
                future: auth.deviceSupportsBiometrics(),
                builder: (context, snapshot) {
                  if (snapshot.data != true) return const SizedBox.shrink();
                  return CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    controlAffinity: ListTileControlAffinity.leading,
                    value: _habilitarBiometria,
                    onChanged: _cargando
                        ? null
                        : (value) => setState(() => _habilitarBiometria = value ?? false),
                    title: const Text('Habilitar ingreso con huella o rostro'),
                    dense: true,
                  );
                },
              ),
            ],
          ],
        ),
      ),
    );
  }
}
