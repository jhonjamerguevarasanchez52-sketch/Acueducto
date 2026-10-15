import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../widgets/core/core.dart';

/// Recuperación de contraseña en dos pasos:
/// 1) el usuario pide un código con su correo,
/// 2) ingresa el código y define su nueva contraseña.
class OlvidePasswordScreen extends StatefulWidget {
  const OlvidePasswordScreen({super.key, this.correoInicial = ''});

  /// Si el usuario ya escribió su correo en el login, llega prellenado.
  final String correoInicial;

  @override
  State<OlvidePasswordScreen> createState() => _OlvidePasswordScreenState();
}

class _OlvidePasswordScreenState extends State<OlvidePasswordScreen> {
  final _formCorreo = GlobalKey<FormState>();
  final _formReset = GlobalKey<FormState>();

  late final TextEditingController _correo;
  final _codigo = TextEditingController();
  final _password = TextEditingController();
  final _confirmar = TextEditingController();

  bool _codigoEnviado = false;
  bool _cargando = false;
  bool _ocultarPassword = true;
  int _segundos = 0;
  Timer? _timer;

  static final _regexCorreo = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');

  @override
  void initState() {
    super.initState();
    _correo = TextEditingController(text: widget.correoInicial);
  }

  @override
  void dispose() {
    _timer?.cancel();
    _correo.dispose();
    _codigo.dispose();
    _password.dispose();
    _confirmar.dispose();
    super.dispose();
  }

  void _iniciarEspera() {
    _timer?.cancel();
    setState(() => _segundos = 60);
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) {
        t.cancel();
        return;
      }
      setState(() => _segundos--);
      if (_segundos <= 0) t.cancel();
    });
  }

  Future<void> _enviarCodigo() async {
    if (!(_formCorreo.currentState?.validate() ?? false)) return;
    FocusScope.of(context).unfocus();
    final api = context.read<AuthProvider>().api;
    setState(() => _cargando = true);
    try {
      await api.post(
        '/auth/solicitar-recuperacion',
        body: {'correo': _correo.text.trim().toLowerCase()},
      );
      if (!mounted) return;
      setState(() => _codigoEnviado = true);
      _iniciarEspera();
      AppSnackbar.info(
        context,
        'Si el correo está registrado, te enviamos un código.',
      );
    } on ApiException catch (e) {
      if (mounted) AppSnackbar.error(context, e.message);
    } catch (_) {
      if (mounted) {
        AppSnackbar.error(context, 'No se pudo enviar el código. Intenta de nuevo.');
      }
    } finally {
      if (mounted) setState(() => _cargando = false);
    }
  }

  Future<void> _restablecer() async {
    if (!(_formReset.currentState?.validate() ?? false)) return;
    FocusScope.of(context).unfocus();
    final api = context.read<AuthProvider>().api;
    setState(() => _cargando = true);
    try {
      await api.post(
        '/auth/resetear-password',
        body: {
          'correo': _correo.text.trim().toLowerCase(),
          'codigo': _codigo.text.trim(),
          'nuevaPassword': _password.text,
        },
      );
      if (!mounted) return;
      AppSnackbar.success(context, 'Contraseña actualizada. Ya puedes ingresar.');
      Navigator.of(context).pop();
    } on ApiException catch (e) {
      if (mounted) AppSnackbar.error(context, e.message);
    } catch (_) {
      if (mounted) {
        AppSnackbar.error(
          context,
          'No se pudo cambiar la contraseña. Intenta de nuevo.',
        );
      }
    } finally {
      if (mounted) setState(() => _cargando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    return GotaScaffold(
      appBar: const HidroAppBar(title: 'Recuperar contraseña'),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 24, 24, 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                _codigoEnviado
                    ? Icons.mark_email_read_outlined
                    : Icons.lock_reset,
                size: 48,
                color: tema.colorScheme.primary,
              ),
              const SizedBox(height: 16),
              Text(
                _codigoEnviado ? 'Revisa tu correo' : '¿Olvidaste tu contraseña?',
                style: tema.textTheme.headlineSmall
                    ?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 8),
              Text(
                _codigoEnviado
                    ? 'Te enviamos un código a ${_correo.text.trim()}. '
                        'Ingrésalo junto con tu nueva contraseña.'
                    : 'Escribe el correo con el que te registraste y te '
                        'enviaremos un código para crear una contraseña nueva.',
                style: tema.textTheme.bodyMedium,
              ),
              const SizedBox(height: 24),
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 250),
                child: _codigoEnviado ? _pasoReset() : _pasoCorreo(),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _pasoCorreo() {
    return Form(
      key: _formCorreo,
      child: Column(
        key: const ValueKey('paso-correo'),
        children: [
          TextFormField(
            controller: _correo,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.done,
            autofillHints: const [AutofillHints.email],
            onFieldSubmitted: (_) => _enviarCodigo(),
            decoration: const InputDecoration(
              labelText: 'Correo electrónico',
              hintText: 'tucorreo@ejemplo.com',
              prefixIcon: Icon(Icons.email_outlined),
            ),
            validator: (v) {
              final valor = (v ?? '').trim();
              if (valor.isEmpty) return 'Escribe tu correo';
              if (!_regexCorreo.hasMatch(valor)) return 'Correo no válido';
              return null;
            },
          ),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _cargando ? null : _enviarCodigo,
              child: _cargando
                  ? const _Cargando()
                  : const Text('Enviar código'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _pasoReset() {
    return Form(
      key: _formReset,
      child: Column(
        key: const ValueKey('paso-reset'),
        children: [
          TextFormField(
            controller: _codigo,
            keyboardType: TextInputType.number,
            textInputAction: TextInputAction.next,
            maxLength: 6,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            decoration: const InputDecoration(
              labelText: 'Código de verificación',
              prefixIcon: Icon(Icons.pin_outlined),
              counterText: '',
            ),
            validator: (v) {
              final valor = (v ?? '').trim();
              if (valor.isEmpty) return 'Escribe el código';
              if (valor.length != 6) return 'El código tiene 6 dígitos';
              return null;
            },
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _password,
            obscureText: _ocultarPassword,
            textInputAction: TextInputAction.next,
            decoration: InputDecoration(
              labelText: 'Nueva contraseña',
              prefixIcon: const Icon(Icons.lock_outline),
              suffixIcon: IconButton(
                tooltip: _ocultarPassword ? 'Mostrar' : 'Ocultar',
                icon: Icon(
                  _ocultarPassword ? Icons.visibility : Icons.visibility_off,
                ),
                onPressed: () =>
                    setState(() => _ocultarPassword = !_ocultarPassword),
              ),
            ),
            validator: (v) {
              final valor = v ?? '';
              if (valor.isEmpty) return 'Escribe tu nueva contraseña';
              if (valor.length < 8) return 'Mínimo 8 caracteres';
              return null;
            },
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _confirmar,
            obscureText: _ocultarPassword,
            textInputAction: TextInputAction.done,
            onFieldSubmitted: (_) => _restablecer(),
            decoration: const InputDecoration(
              labelText: 'Confirmar contraseña',
              prefixIcon: Icon(Icons.lock_outline),
            ),
            validator: (v) =>
                v != _password.text ? 'Las contraseñas no coinciden' : null,
          ),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _cargando ? null : _restablecer,
              child: _cargando
                  ? const _Cargando()
                  : const Text('Cambiar contraseña'),
            ),
          ),
          const SizedBox(height: 8),
          TextButton(
            onPressed: (_cargando || _segundos > 0) ? null : _enviarCodigo,
            child: Text(
              _segundos > 0
                  ? 'Reenviar código en ${_segundos}s'
                  : 'Reenviar código',
            ),
          ),
          TextButton(
            onPressed: _cargando
                ? null
                : () => setState(() {
                      _codigoEnviado = false;
                      _codigo.clear();
                    }),
            child: const Text('Usar otro correo'),
          ),
        ],
      ),
    );
  }
}

class _Cargando extends StatelessWidget {
  const _Cargando();

  @override
  Widget build(BuildContext context) {
    return const SizedBox(
      height: 20,
      width: 20,
      child: CircularProgressIndicator(strokeWidth: 2),
    );
  }
}