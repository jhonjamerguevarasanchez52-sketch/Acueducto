import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../providers/auth_provider.dart';
import '../../screens/olvide_password_screen.dart';
import '../../screens/verificar_cuenta_screen.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import '../core/app_snackbar.dart';
import 'auth_style.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

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
  bool _ingresarConCedula = false;
  bool _cargando = false;
  bool _verPassword = false;

  @override
  void initState() {
    super.initState();
    // Si el usuario activó la huella o el rostro en Ajustes, se pide al abrir
    // la app; si la cancela, entra con correo y contraseña.
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
        conCedula: _ingresarConCedula,
      );
      // La huella o el rostro se activan después, desde Ajustes en Perfil.
      // AuthGate observa el AuthProvider y esta misma ruta se reconstruye
      // como HomeScreen al quedar autenticado: no hay nada que "pop-ear".
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.requiereVerificacion) {
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => VerificarCuentaScreen(
              correo: e.data is Map
                  ? (e.data as Map)['correo']?.toString() ?? _correoCtrl.text.trim()
                  : _correoCtrl.text.trim(),
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

  // Solo se prellena el correo si lo que escribieron parece un correo.
  String get _correoEscrito {
    final correo = _correoCtrl.text.trim();
    return _correoValido.hasMatch(correo) ? correo : '';
  }

  void _recuperarPassword() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => OlvidePasswordScreen(correoInicial: _correoEscrito),
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
            Text(
              'Ingresa con tu ${_ingresarConCedula ? 'cédula' : 'correo'} y contraseña',
              style: TextStyle(fontSize: 13.5, color: authMutedDe(context)),
            ),
            const SizedBox(height: 22),
            Row(
              children: [
                Expanded(
                  child: ChoiceChip(
                    label: const Text('Correo'),
                    selected: !_ingresarConCedula,
                    onSelected: _cargando ? null : (_) => setState(() => _ingresarConCedula = false),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: ChoiceChip(
                    label: const Text('Cédula'),
                    selected: _ingresarConCedula,
                    onSelected: _cargando ? null : (_) => setState(() => _ingresarConCedula = true),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            authFieldLabel(context, _ingresarConCedula ? 'CÉDULA' : 'CORREO ELECTRÓNICO'),
            TextFormField(
              controller: _correoCtrl,
              keyboardType: _ingresarConCedula ? TextInputType.number : TextInputType.emailAddress,
              inputFormatters: _ingresarConCedula
                  ? [FilteringTextInputFormatter.digitsOnly]
                  : const [],
              autocorrect: false,
              textInputAction: TextInputAction.next,
              decoration: authInputDecoration(
                context,
                hint: _ingresarConCedula ? 'Número de cédula' : 'tucorreo@ejemplo.com',
                icon: _ingresarConCedula ? Icons.badge_outlined : LucideIcons.mail,
              ),
              validator: (v) {
                final t = v?.trim() ?? '';
                if (t.isEmpty) return _ingresarConCedula ? 'Ingresa tu cédula' : 'Ingresa tu correo';
                if (_ingresarConCedula && (t.length < 5 || t.length > 15)) {
                  return 'Ingresa una cédula válida';
                }
                if (!_ingresarConCedula && !_correoValido.hasMatch(t)) {
                  return 'Correo no válido';
                }
                return null;
 git add lib/widgets/auth/login_form.dart             },
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
                icon: LucideIcons.lock,
                suffix: IconButton(
                  splashRadius: 20,
                  icon: Icon(
                    _verPassword
                        ? LucideIcons.eyeOff
                        : LucideIcons.eye,
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
          ],
        ),
      ),
    );
  }
}
