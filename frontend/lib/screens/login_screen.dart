import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../widgets/hidro_logo.dart';

/// Pantalla de inicio de sesión de HIDRO-APP.
///
/// Cabecera azul con el logo y los datos del acueducto, y una tarjeta blanca
/// con el formulario. Las cuentas las crea el administrador: no hay
/// auto-registro.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _correoCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  bool _cargando = false;
  bool _verPassword = false;

  static const Color _muted = Color(0xFF6C8797);
  static const Color _label = Color(0xFF5B7A8B);
  static const Color _fieldFill = Color(0xFFEEF4F9);
  static const Color _fieldBorder = Color(0xFFDCE7EF);

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
      // AuthGate cambia de pantalla automáticamente al autenticar.
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message)),
        );
      }
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

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: const Color(0xFFF4F8FB),
        body: SingleChildScrollView(
          child: Column(
            children: [
              _buildHeader(),
              Transform.translate(
                offset: const Offset(0, -28),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
                  child: Column(
                    children: [
                      _buildCard(onSurface),
                      const SizedBox(height: 18),
                      const Text(
                        '¿Sin cuenta? Solicítala al administrador del acueducto.',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 12, color: _muted),
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

  Widget _buildHeader() {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.fromLTRB(
        24,
        MediaQuery.of(context).padding.top + 36,
        24,
        52,
      ),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [AppTheme.midBlue, AppTheme.deepBlue],
        ),
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(32)),
      ),
      child: Column(
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
      ),
    );
  }

  Widget _buildCard(Color onSurface) {
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        boxShadow: [
          BoxShadow(
            color: AppTheme.deepBlue.withValues(alpha: 0.10),
            blurRadius: 24,
            offset: const Offset(0, 12),
          ),
        ],
      ),
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
              style: TextStyle(fontSize: 13.5, color: _muted),
            ),
            const SizedBox(height: 22),
            _fieldLabel('CORREO ELECTRÓNICO'),
            TextFormField(
              controller: _correoCtrl,
              keyboardType: TextInputType.emailAddress,
              autocorrect: false,
              textInputAction: TextInputAction.next,
              decoration: _decoration(
                hint: 'tucorreo@ejemplo.com',
                icon: Icons.mail_outline,
              ),
              validator: (v) {
                final t = v?.trim() ?? '';
                if (t.isEmpty) return 'Ingresa tu correo';
                if (!t.contains('@') || !t.contains('.')) {
                  return 'Correo no válido';
                }
                return null;
              },
            ),
            const SizedBox(height: 16),
            _fieldLabel('CONTRASEÑA'),
            TextFormField(
              controller: _passwordCtrl,
              obscureText: !_verPassword,
              textInputAction: TextInputAction.done,
              onFieldSubmitted: (_) => _cargando ? null : _entrar(),
              decoration: _decoration(
                hint: '••••••••',
                icon: Icons.lock_outline,
                suffix: IconButton(
                  splashRadius: 20,
                  icon: Icon(
                    _verPassword
                        ? Icons.visibility_off_outlined
                        : Icons.visibility_outlined,
                    color: _muted,
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

  Widget _fieldLabel(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Text(
          text,
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.8,
            color: _label,
          ),
        ),
      );

  InputDecoration _decoration({
    required String hint,
    required IconData icon,
    Widget? suffix,
  }) {
    OutlineInputBorder border(Color color, [double width = 1]) =>
        OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: color, width: width),
        );

    return InputDecoration(
      hintText: hint,
      hintStyle: const TextStyle(color: Color(0xFF9FB4C2)),
      prefixIcon: Icon(icon, color: AppTheme.primary, size: 20),
      suffixIcon: suffix,
      filled: true,
      fillColor: _fieldFill,
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
      enabledBorder: border(_fieldBorder),
      focusedBorder: border(AppTheme.primary, 1.6),
      errorBorder: border(const Color(0xFFD9534F)),
      focusedErrorBorder: border(const Color(0xFFD9534F), 1.6),
    );
  }
}
