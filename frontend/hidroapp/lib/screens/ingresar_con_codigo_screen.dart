import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../widgets/core/core.dart';

/// Ingreso sin contraseña en dos pasos:
/// 1) el usuario escribe su correo y recibe un código de 6 dígitos,
/// 2) escribe el código y entra.
///
/// Pensado para quien no recuerda su contraseña: no tiene que crear una nueva.
class IngresarConCodigoScreen extends StatefulWidget {
  const IngresarConCodigoScreen({super.key, this.correoInicial = ''});

  /// Si el usuario ya escribió su correo en el login, llega prellenado.
  final String correoInicial;

  @override
  State<IngresarConCodigoScreen> createState() => _IngresarConCodigoScreenState();
}

class _IngresarConCodigoScreenState extends State<IngresarConCodigoScreen> {
  final _formCorreo = GlobalKey<FormState>();
  final _formCodigo = GlobalKey<FormState>();

  late final TextEditingController _correo;
  final _codigo = TextEditingController();

  bool _codigoEnviado = false;
  bool _cargando = false;
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
    if (!(_formCorreo.currentState?.validate() ?? _codigoEnviado)) return;
    FocusScope.of(context).unfocus();
    final auth = context.read<AuthProvider>();
    setState(() => _cargando = true);
    try {
      await auth.solicitarCodigoAcceso(_correo.text);
      if (!mounted) return;
      setState(() => _codigoEnviado = true);
      _iniciarEspera();
      AppSnackbar.info(context, 'Si el correo está registrado, te llegará un código.');
    } on ApiException catch (e) {
      if (mounted) AppSnackbar.error(context, e.message);
    } catch (_) {
      if (mounted) AppSnackbar.error(context, 'No se pudo enviar el código. Intenta de nuevo.');
    } finally {
      if (mounted) setState(() => _cargando = false);
    }
  }

  Future<void> _entrar() async {
    if (!(_formCodigo.currentState?.validate() ?? false)) return;
    FocusScope.of(context).unfocus();
    final auth = context.read<AuthProvider>();
    final navegador = Navigator.of(context);
    setState(() => _cargando = true);
    try {
      await auth.loginConCodigo(_correo.text, _codigo.text);
      // AuthGate muestra la app al quedar autenticado; cerramos esta pantalla.
      navegador.popUntil((ruta) => ruta.isFirst);
    } on ApiException catch (e) {
      if (mounted) AppSnackbar.error(context, e.message);
    } catch (_) {
      if (mounted) AppSnackbar.error(context, 'No se pudo ingresar. Intenta de nuevo.');
    } finally {
      if (mounted) setState(() => _cargando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    return GotaScaffold(
      appBar: const HidroAppBar(title: 'Entrar con código'),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 24, 24, 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                _codigoEnviado ? Icons.mark_email_read_outlined : Icons.mail_lock_outlined,
                size: 48,
                color: tema.colorScheme.primary,
              ),
              const SizedBox(height: 16),
              Text(
                _codigoEnviado ? 'Revisa tu correo' : 'Entra sin contraseña',
                style: tema.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 8),
              Text(
                _codigoEnviado
                    ? 'Te enviamos un código de 6 dígitos a ${_correo.text.trim()}. '
                        'Escríbelo aquí. Vence en 15 minutos.'
                    : 'Escribe tu correo y te enviaremos un código para entrar. '
                        'No necesitas recordar ninguna contraseña.',
                style: tema.textTheme.bodyMedium,
              ),
              const SizedBox(height: 24),
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 250),
                child: _codigoEnviado ? _pasoCodigo() : _pasoCorreo(),
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
              child: _cargando ? const _Cargando() : const Text('Enviarme el código'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _pasoCodigo() {
    return Form(
      key: _formCodigo,
      child: Column(
        key: const ValueKey('paso-codigo'),
        children: [
          TextFormField(
            controller: _codigo,
            autofocus: true,
            keyboardType: TextInputType.number,
            textInputAction: TextInputAction.done,
            maxLength: 6,
            autofillHints: const [AutofillHints.oneTimeCode],
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 26, letterSpacing: 10, fontWeight: FontWeight.w700),
            onChanged: (valor) {
              // Con los 6 dígitos completos entra solo, sin buscar el botón.
              if (valor.length == 6 && !_cargando) _entrar();
            },
            onFieldSubmitted: (_) => _entrar(),
            decoration: const InputDecoration(
              labelText: 'Código de 6 dígitos',
              counterText: '',
            ),
            validator: (v) {
              final valor = (v ?? '').trim();
              if (valor.isEmpty) return 'Escribe el código';
              if (valor.length != 6) return 'El código tiene 6 dígitos';
              return null;
            },
          ),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _cargando ? null : _entrar,
              child: _cargando ? const _Cargando() : const Text('Entrar'),
            ),
          ),
          const SizedBox(height: 8),
          TextButton(
            onPressed: (_cargando || _segundos > 0) ? null : _enviarCodigo,
            child: Text(_segundos > 0 ? 'Reenviar código en ${_segundos}s' : 'Reenviar código'),
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
