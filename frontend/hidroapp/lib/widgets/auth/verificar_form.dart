import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import '../core/app_snackbar.dart';
import 'auth_style.dart';

/// Tarjeta blanca con el formulario de verificación de cuenta: el campo del
/// código de 6 dígitos, el botón de verificar y el enlace para reenviarlo.
/// Conserva su propio estado y las llamadas a `AuthProvider`.
class VerificarCuentaForm extends StatefulWidget {
  const VerificarCuentaForm({
    super.key,
    required this.correo,
    required this.password,
  });

  final String correo;
  final String password;

  @override
  State<VerificarCuentaForm> createState() => _VerificarCuentaFormState();
}

class _VerificarCuentaFormState extends State<VerificarCuentaForm> {
  final _formKey = GlobalKey<FormState>();
  final _codigoCtrl = TextEditingController();
  bool _verificando = false;
  bool _reenviando = false;

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
      if (mounted) AppSnackbar.error(context, e.message);
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
        AppSnackbar.info(
          context,
          'Si la cuenta no está verificada, te enviamos un código nuevo.',
        );
      }
    } on ApiException catch (e) {
      if (mounted) AppSnackbar.error(context, e.message);
    } finally {
      if (mounted) setState(() => _reenviando = false);
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
                style: TextStyle(
                    fontSize: 13.5, color: authMutedDe(context), height: 1.4),
                children: [
                  const TextSpan(
                    text: 'Enviamos un código de 6 dígitos a\n',
                  ),
                  TextSpan(
                    text: widget.correo,
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: authLabelDe(context),
                    ),
                  ),
                  const TextSpan(
                      text: '. Escríbelo aquí para activar tu cuenta.'),
                ],
              ),
            ),
            const SizedBox(height: 22),
            authFieldLabel(context, 'CÓDIGO DE VERIFICACIÓN'),
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
              decoration: authInputDecoration(
                context,
                hint: '000000',
                counterText: '',
                hintStyle: const TextStyle(
                  color: Color(0xFF9FB4C2),
                  letterSpacing: 8,
                  fontWeight: FontWeight.w700,
                ),
              ),
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
}
