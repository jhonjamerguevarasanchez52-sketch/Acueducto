import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../providers/auth_provider.dart';
import '../../screens/olvide_password_screen.dart';
import '../../screens/verificar_cuenta_screen.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import '../core/app_snackbar.dart';
import 'auth_style.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

/// Cómo se identifica la persona al iniciar sesión.
enum MetodoIngreso { correo, cedula }

/// Tarjeta blanca con el formulario de inicio de sesión: un selector para
/// entrar con correo o con cédula, la contraseña y el botón de entrar. Conserva su propio estado (controllers, validación y la
/// llamada a `AuthProvider.login`); si la cuenta no está verificada, abre la
/// pantalla de verificación.
class LoginForm extends StatefulWidget {
  const LoginForm({super.key});

  /// Tras este tiempo sin respuesta se avisa que el servidor está despertando.
  static const esperaAntesDelAviso = Duration(seconds: 6);

  static const avisoServidorDespertando =
      'El servidor se está despertando, esto puede tardar hasta un minuto. '
      'No cierres la app.';

  @override
  State<LoginForm> createState() => _LoginFormState();
}

class _LoginFormState extends State<LoginForm> {
  static final _correoValido = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');
  static final _cedulaValida = RegExp(r'^[0-9]{5,15}$');

  final _formKey = GlobalKey<FormState>();
  final _correoCtrl = TextEditingController();
  final _cedulaCtrl = TextEditingController();
  MetodoIngreso _metodo = MetodoIngreso.correo;
  final _passwordCtrl = TextEditingController();
  bool _cargando = false;
  bool _servidorLento = false;
  Timer? _avisoLento;
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
      if (mounted) {
        AppSnackbar.error(
          context,
          'No se pudo validar la biometría. Intenta con tu contraseña.',
        );
      }
    } finally {
      if (mounted) setState(() => _cargando = false);
    }
  }

  @override
  void dispose() {
    _avisoLento?.cancel();
    _correoCtrl.dispose();
    _cedulaCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  Future<void> _entrar() async {
    if (!_formKey.currentState!.validate()) return;
    final auth = context.read<AuthProvider>();
    FocusScope.of(context).unfocus();
    setState(() => _cargando = true);
    // Si el servidor estaba dormido (Render gratuito) la respuesta puede
    // tardar cerca de un minuto: se explica en vez de dejar solo el círculo.
    _avisoLento?.cancel();
    _avisoLento = Timer(LoginForm.esperaAntesDelAviso, () {
      if (mounted && _cargando) setState(() => _servidorLento = true);
    });
    try {
      if (_metodo == MetodoIngreso.cedula) {
        await auth.loginConCedula(_cedulaCtrl.text, _passwordCtrl.text);
      } else {
        await auth.login(_correoCtrl.text, _passwordCtrl.text);
      }
      // La huella o el rostro se activan después, desde Ajustes en Perfil.
      // AuthGate observa el AuthProvider y esta misma ruta se reconstruye
      // como HomeScreen al quedar autenticado: no hay nada que "pop-ear".
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.requiereVerificacion && _metodo == MetodoIngreso.correo) {
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
    } catch (_) {
      // Fallos que no vienen del servidor (por ejemplo, el teléfono no pudo
      // guardar la sesión): antes no se mostraba ningún mensaje.
      if (mounted) {
        AppSnackbar.error(
          context,
          'No se pudo iniciar sesión en este teléfono. Intenta de nuevo.',
        );
      }
    } finally {
      _avisoLento?.cancel();
      if (mounted) {
        setState(() {
          _cargando = false;
          _servidorLento = false;
        });
      }
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
              'Elige si ingresas con tu correo o con tu cédula',
              style: TextStyle(fontSize: 13.5, color: authMutedDe(context)),
            ),
            const SizedBox(height: 22),
            SegmentedButton<MetodoIngreso>(
              key: const Key('selector_metodo_ingreso'),
              showSelectedIcon: false,
              segments: const [
                ButtonSegment(
                  value: MetodoIngreso.correo,
                  label: Text('Correo'),
                  icon: Icon(LucideIcons.mail, size: 18),
                ),
                ButtonSegment(
                  value: MetodoIngreso.cedula,
                  label: Text('Cédula'),
                  icon: Icon(LucideIcons.idCard, size: 18),
                ),
              ],
              selected: {_metodo},
              onSelectionChanged: _cargando
                  ? null
                  : (seleccion) => setState(() => _metodo = seleccion.first),
            ),
            const SizedBox(height: 18),
            if (_metodo == MetodoIngreso.correo) ...[
              authFieldLabel(context, 'CORREO ELECTRÓNICO'),
              TextFormField(
                key: const Key('campo_correo'),
                controller: _correoCtrl,
                keyboardType: TextInputType.emailAddress,
                autocorrect: false,
                textInputAction: TextInputAction.next,
                decoration: authInputDecoration(
                  context,
                  hint: 'tucorreo@ejemplo.com',
                  icon: LucideIcons.mail,
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
            ] else ...[
              authFieldLabel(context, 'NÚMERO DE CÉDULA'),
              TextFormField(
                key: const Key('campo_cedula'),
                controller: _cedulaCtrl,
                keyboardType: TextInputType.number,
                autocorrect: false,
                textInputAction: TextInputAction.next,
                decoration: authInputDecoration(
                  context,
                  hint: 'Solo números, sin puntos',
                  icon: LucideIcons.idCard,
                ),
                validator: (v) {
                  final t = AuthProvider.soloDigitosCedula(v ?? '');
                  if (t.isEmpty) return 'Ingresa tu número de cédula';
                  if (!_cedulaValida.hasMatch(t)) {
                    return 'La cédula debe tener entre 5 y 15 números';
                  }
                  return null;
                },
              ),
            ],
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
                    _verPassword ? LucideIcons.eyeOff : LucideIcons.eye,
                    color: authMutedDe(context),
                    size: 20,
                  ),
                  onPressed: () => setState(() => _verPassword = !_verPassword),
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
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
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
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Text('Ingresar al sistema'),
            ),
            if (_cargando && _servidorLento) ...[
              const SizedBox(height: 12),
              Text(
                LoginForm.avisoServidorDespertando,
                key: const Key('aviso_servidor_despertando'),
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12.5, color: authMutedDe(context)),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
