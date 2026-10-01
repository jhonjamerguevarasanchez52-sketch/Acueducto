import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../widgets/auth/auth_style.dart';
import 'recuperar_password_screen.dart';

/// Cambio voluntario de contraseña, abierto desde "Mi perfil". Pide la
/// contraseña actual y la nueva (dos veces). Si el usuario no recuerda la
/// actual, ofrece ir al flujo de recuperación por código al correo.
class CambiarPasswordScreen extends StatefulWidget {
  const CambiarPasswordScreen({super.key});

  @override
  State<CambiarPasswordScreen> createState() => _CambiarPasswordScreenState();
}

class _CambiarPasswordScreenState extends State<CambiarPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _actualCtrl = TextEditingController();
  final _nuevaCtrl = TextEditingController();
  final _confirmarCtrl = TextEditingController();
  bool _verActual = false;
  bool _verNueva = false;
  bool _guardando = false;

  @override
  void dispose() {
    _actualCtrl.dispose();
    _nuevaCtrl.dispose();
    _confirmarCtrl.dispose();
    super.dispose();
  }

  Future<void> _guardar() async {
    if (!_formKey.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() => _guardando = true);
    try {
      await context.read<AuthProvider>().cambiarPassword(
            _actualCtrl.text,
            _nuevaCtrl.text,
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Contraseña actualizada correctamente')),
      );
      Navigator.of(context).pop();
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message)),
        );
      }
    } finally {
      if (mounted) setState(() => _guardando = false);
    }
  }

  void _olvideMiPassword() {
    final correo = context.read<AuthProvider>().profile?.correo ?? '';
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => RecuperarPasswordScreen(correoInicial: correo),
      ),
    );
  }

  Widget _botonVer(bool visible, VoidCallback onPressed) => IconButton(
        splashRadius: 20,
        icon: Icon(
          visible ? Icons.visibility_off_outlined : Icons.visibility_outlined,
          color: authMuted,
          size: 20,
        ),
        onPressed: onPressed,
      );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Cambiar contraseña')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          AuthCard(
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'Por seguridad, primero confirma tu contraseña actual.',
                    style: TextStyle(
                        fontSize: 13.5, color: authMuted, height: 1.4),
                  ),
                  const SizedBox(height: 22),
                  authFieldLabel(context, 'CONTRASEÑA ACTUAL'),
                  TextFormField(
                    controller: _actualCtrl,
                    obscureText: !_verActual,
                    textInputAction: TextInputAction.next,
                    decoration: authInputDecoration(
                      context,
                      hint: 'Tu contraseña actual',
                      icon: Icons.lock_clock_outlined,
                      suffix: _botonVer(_verActual,
                          () => setState(() => _verActual = !_verActual)),
                    ),
                    validator: (v) => (v == null || v.isEmpty)
                        ? 'Ingresa tu contraseña actual'
                        : null,
                  ),
                  const SizedBox(height: 16),
                  authFieldLabel(context, 'NUEVA CONTRASEÑA'),
                  TextFormField(
                    controller: _nuevaCtrl,
                    obscureText: !_verNueva,
                    textInputAction: TextInputAction.next,
                    decoration: authInputDecoration(
                      context,
                      hint: 'Mínimo 8 caracteres',
                      icon: Icons.lock_outline,
                      suffix: _botonVer(_verNueva,
                          () => setState(() => _verNueva = !_verNueva)),
                    ),
                    validator: (v) {
                      final t = v ?? '';
                      if (t.length < 8) return 'Debe tener al menos 8 caracteres';
                      if (t == _actualCtrl.text) {
                        return 'Debe ser distinta de la actual';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),
                  authFieldLabel(context, 'CONFIRMAR NUEVA CONTRASEÑA'),
                  TextFormField(
                    controller: _confirmarCtrl,
                    obscureText: !_verNueva,
                    textInputAction: TextInputAction.done,
                    onFieldSubmitted: (_) => _guardando ? null : _guardar(),
                    decoration: authInputDecoration(
                      context,
                      hint: 'Repite la nueva contraseña',
                      icon: Icons.lock_outline,
                    ),
                    validator: (v) => v != _nuevaCtrl.text
                        ? 'Las contraseñas no coinciden'
                        : null,
                  ),
                  const SizedBox(height: 22),
                  FilledButton(
                    onPressed: _guardando ? null : _guardar,
                    child: _guardando
                        ? const SizedBox(
                            height: 22,
                            width: 22,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white),
                          )
                        : const Text('Guardar contraseña'),
                  ),
                  const SizedBox(height: 4),
                  TextButton(
                    onPressed: _guardando ? null : _olvideMiPassword,
                    child: const Text('¿Olvidaste tu contraseña actual?'),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
