import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../widgets/hidro_logo.dart';

/// Pantalla de confirmación de cuenta.
///
/// Al crear una cuenta el backend envía un código de 6 dígitos por correo. El
/// backend no permite iniciar sesión hasta que ese código se confirma aquí. Si
/// el código es válido, la sesión queda iniciada y [AuthGate] muestra el inicio.
class VerificarCuentaScreen extends StatefulWidget {
  const VerificarCuentaScreen({
    super.key,
    required this.correo,
    required this.password,
  });

  final String correo;
  final String password;

  @override
  State<VerificarCuentaScreen> createState() => _VerificarCuentaScreenState();
}

class _VerificarCuentaScreenState extends State<VerificarCuentaScreen> {
  final _formKey = GlobalKey<FormState>();
  final _codigoCtrl = TextEditingController();
  bool _verificando = false;
  bool _reenviando = false;

  static const Color _muted = Color(0xFF6C8797);
  static const Color _label = Color(0xFF5B7A8B);
  static const Color _fieldFill = Color(0xFFEEF4F9);
  static const Color _fieldBorder = Color(0xFFDCE7EF);

  @override
  void dispose() {
    _codigoCtrl.dispose();
    super.dispose();
  }

  Future<void> _verificar() async {
    if (!_formKey.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() => _verificando = true);
    try {
      await context.read<AuthProvider>().verificarCuenta(
            widget.correo,
            _codigoCtrl.text,
            widget.password,
          );
      // Sesión iniciada: AuthGate reconstruye esta ruta como HomeScreen. Al
      // salir de la pila, la pantalla de login que quedó debajo también se va.
      if (mounted) Navigator.of(context).pop();
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message)),
        );
      }
    } finally {
      if (mounted) setState(() => _verificando = false);
    }
  }

  Future<void> _reenviar() async {
    if (_reenviando) return;
    setState(() => _reenviando = true);
    try {
      await context
          .read<AuthProvider>()
          .reenviarCodigoVerificacion(widget.correo);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Si la cuenta no está verificada, te enviamos un código nuevo.',
            ),
          ),
        );
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message)),
        );
      }
    } finally {
      if (mounted) setState(() => _reenviando = false);
    }
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
                  child: _buildCard(onSurface),
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
        MediaQuery.of(context).padding.top + 20,
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
              'Revisa tu correo',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: onSurface,
              ),
            ),
            const SizedBox(height: 6),
            Text.rich(
              TextSpan(
                style: const TextStyle(fontSize: 13.5, color: _muted, height: 1.4),
                children: [
                  const TextSpan(
                    text: 'Enviamos un código de 6 dígitos a\n',
                  ),
                  TextSpan(
                    text: widget.correo,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      color: _label,
                    ),
                  ),
                  const TextSpan(text: '. Escríbelo aquí para activar tu cuenta.'),
                ],
              ),
            ),
            const SizedBox(height: 22),
            _fieldLabel('CÓDIGO DE VERIFICACIÓN'),
            TextFormField(
              controller: _codigoCtrl,
              keyboardType: TextInputType.number,
              textInputAction: TextInputAction.done,
              maxLength: 6,
              autofocus: true,
              onFieldSubmitted: (_) => _verificando ? null : _verificar(),
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(6),
              ],
              style: const TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w700,
                letterSpacing: 8,
              ),
              textAlign: TextAlign.center,
              decoration: _decoration(hint: '000000'),
              validator: (v) {
                final t = v?.trim() ?? '';
                if (t.length != 6) return 'Ingresa los 6 dígitos';
                return null;
              },
            ),
            const SizedBox(height: 6),
            FilledButton(
              onPressed: _verificando ? null : _verificar,
              child: _verificando
                  ? const SizedBox(
                      height: 22,
                      width: 22,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Verificar y entrar'),
            ),
            const SizedBox(height: 4),
            TextButton(
              onPressed: _reenviando ? null : _reenviar,
              style: TextButton.styleFrom(foregroundColor: AppTheme.primary),
              child: Text(
                _reenviando ? 'Enviando…' : 'Reenviar código',
              ),
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

  InputDecoration _decoration({required String hint}) {
    OutlineInputBorder border(Color color, [double width = 1]) =>
        OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: color, width: width),
        );

    return InputDecoration(
      hintText: hint,
      counterText: '',
      hintStyle: const TextStyle(
        color: Color(0xFF9FB4C2),
        letterSpacing: 8,
        fontWeight: FontWeight.w700,
      ),
      filled: true,
      fillColor: _fieldFill,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
      enabledBorder: border(_fieldBorder),
      focusedBorder: border(AppTheme.primary, 1.6),
      errorBorder: border(const Color(0xFFD9534F)),
      focusedErrorBorder: border(const Color(0xFFD9534F), 1.6),
    );
  }
}
