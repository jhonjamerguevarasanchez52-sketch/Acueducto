import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import 'auth_style.dart';

/// Tarjeta blanca con el flujo de recuperación de contraseña en dos pasos:
/// 1. el correo, al que el backend envía un código de 6 dígitos;
/// 2. el código recibido y la nueva contraseña (con su confirmación).
/// Conserva su propio estado y las llamadas a `AuthProvider`.
class RecuperarPasswordForm extends StatefulWidget {
  const RecuperarPasswordForm({super.key, this.correoInicial = ''});

  final String correoInicial;

  @override
  State<RecuperarPasswordForm> createState() => _RecuperarPasswordFormState();
}

class _RecuperarPasswordFormState extends State<RecuperarPasswordForm> {
  static final _correoValido = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');

  final _formKey = GlobalKey<FormState>();
  late final _correoCtrl = TextEditingController(text: widget.correoInicial);
  final _codigoCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _confirmarCtrl = TextEditingController();

  /// `false` mientras se pide el correo; `true` cuando ya se envió el código.
  bool _codigoEnviado = false;
  bool _cargando = false;
  bool _reenviando = false;
  bool _verPassword = false;

  @override
  void dispose() {
    _correoCtrl.dispose();
    _codigoCtrl.dispose();
    _passwordCtrl.dispose();
    _confirmarCtrl.dispose();
    super.dispose();
  }

  void _mensaje(String texto) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(texto)),
    );
  }

  Future<void> _enviarCodigo() async {
    if (!_formKey.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() => _cargando = true);
    try {
      await context
          .read<AuthProvider>()
          .solicitarRecuperacion(_correoCtrl.text);
      if (!mounted) return;
      setState(() => _codigoEnviado = true);
      _mensaje('Si el correo está registrado, te enviamos un código.');
    } on ApiException catch (e) {
      if (mounted) _mensaje(e.message);
    } finally {
      if (mounted) setState(() => _cargando = false);
    }
  }

  Future<void> _reenviar() async {
    if (_reenviando) return;
    setState(() => _reenviando = true);
    try {
      await context
          .read<AuthProvider>()
          .solicitarRecuperacion(_correoCtrl.text);
      if (mounted) _mensaje('Te enviamos un código nuevo.');
    } on ApiException catch (e) {
      if (mounted) _mensaje(e.message);
    } finally {
      if (mounted) setState(() => _reenviando = false);
    }
  }

  Future<void> _cambiarPassword() async {
    if (!_formKey.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() => _cargando = true);
    try {
      await context.read<AuthProvider>().resetearPassword(
            _correoCtrl.text,
            _codigoCtrl.text,
            _passwordCtrl.text,
          );
      if (!mounted) return;
      _mensaje('Contraseña actualizada. Ya puedes iniciar sesión.');
      Navigator.of(context).pop();
    } on ApiException catch (e) {
      if (mounted) _mensaje(e.message);
    } finally {
      if (mounted) setState(() => _cargando = false);
    }
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
              _codigoEnviado ? 'Crea tu nueva contraseña' : '¿Olvidaste tu contraseña?',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: onSurface,
              ),
            ),
            const SizedBox(height: 6),
            if (!_codigoEnviado)
              const Text(
                'Escribe el correo de tu cuenta y te enviaremos un código '
                'de 6 dígitos para restablecerla.',
                style: TextStyle(fontSize: 13.5, color: authMuted, height: 1.4),
              )
            else
              Text.rich(
                TextSpan(
                  style: const TextStyle(
                      fontSize: 13.5, color: authMuted, height: 1.4),
                  children: [
                    const TextSpan(text: 'Enviamos un código a\n'),
                    TextSpan(
                      text: _correoCtrl.text.trim(),
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        color: authLabel,
                      ),
                    ),
                    const TextSpan(text: '. Expira en 15 minutos.'),
                  ],
                ),
              ),
            const SizedBox(height: 22),
            ..._codigoEnviado ? _pasoPassword() : _pasoCorreo(),
          ],
        ),
      ),
    );
  }

  List<Widget> _pasoCorreo() => [
        authFieldLabel('CORREO ELECTRÓNICO'),
        TextFormField(
          controller: _correoCtrl,
          keyboardType: TextInputType.emailAddress,
          autocorrect: false,
          textInputAction: TextInputAction.done,
          onFieldSubmitted: (_) => _cargando ? null : _enviarCodigo(),
          decoration: authInputDecoration(
            hint: 'tucorreo@ejemplo.com',
            icon: Icons.mail_outline,
          ),
          validator: (v) {
            final t = v?.trim() ?? '';
            if (t.isEmpty) return 'Ingresa tu correo';
            if (!_correoValido.hasMatch(t)) return 'Correo no válido';
            return null;
          },
        ),
        const SizedBox(height: 24),
        FilledButton(
          onPressed: _cargando ? null : _enviarCodigo,
          child: _cargando ? const _Cargando() : const Text('Enviar código'),
        ),
      ];

  List<Widget> _pasoPassword() => [
        authFieldLabel('CÓDIGO DE RECUPERACIÓN'),
        TextFormField(
          controller: _codigoCtrl,
          keyboardType: TextInputType.number,
          textInputAction: TextInputAction.next,
          maxLength: 6,
          autofocus: true,
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
          decoration: authInputDecoration(hint: '000000', counterText: ''),
          validator: (v) =>
              (v?.trim().length ?? 0) != 6 ? 'Ingresa los 6 dígitos' : null,
        ),
        const SizedBox(height: 16),
        authFieldLabel('NUEVA CONTRASEÑA'),
        TextFormField(
          controller: _passwordCtrl,
          obscureText: !_verPassword,
          textInputAction: TextInputAction.next,
          decoration: authInputDecoration(
            hint: 'Mínimo 8 caracteres',
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
              onPressed: () => setState(() => _verPassword = !_verPassword),
            ),
          ),
          validator: (v) => (v == null || v.length < 8)
              ? 'Debe tener al menos 8 caracteres'
              : null,
        ),
        const SizedBox(height: 16),
        authFieldLabel('CONFIRMAR CONTRASEÑA'),
        TextFormField(
          controller: _confirmarCtrl,
          obscureText: !_verPassword,
          textInputAction: TextInputAction.done,
          onFieldSubmitted: (_) => _cargando ? null : _cambiarPassword(),
          decoration: authInputDecoration(
            hint: 'Repite la contraseña',
            icon: Icons.lock_outline,
          ),
          validator: (v) => v != _passwordCtrl.text
              ? 'Las contraseñas no coinciden'
              : null,
        ),
        const SizedBox(height: 24),
        FilledButton(
          onPressed: _cargando ? null : _cambiarPassword,
          child:
              _cargando ? const _Cargando() : const Text('Cambiar contraseña'),
        ),
        const SizedBox(height: 4),
        TextButton(
          onPressed: _reenviando ? null : _reenviar,
          style: TextButton.styleFrom(foregroundColor: AppTheme.primary),
          child: Text(_reenviando ? 'Enviando…' : 'Reenviar código'),
        ),
        TextButton(
          onPressed: _cargando
              ? null
              : () => setState(() {
                    _codigoEnviado = false;
                    _codigoCtrl.clear();
                  }),
          style: TextButton.styleFrom(foregroundColor: authMuted),
          child: const Text('Usar otro correo'),
        ),
      ];
}

class _Cargando extends StatelessWidget {
  const _Cargando();

  @override
  Widget build(BuildContext context) => const SizedBox(
        height: 22,
        width: 22,
        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
      );
}
