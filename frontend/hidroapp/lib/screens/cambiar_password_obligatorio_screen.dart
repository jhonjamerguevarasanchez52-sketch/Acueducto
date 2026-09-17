import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../widgets/hidro_logo.dart';

/// Pantalla de cambio de contraseña obligatorio.
///
/// [AuthGate] la muestra en vez de la app normal cuando la cuenta todavía
/// tiene la contraseña temporal que le generó un administrador al crearla
/// (perfil.debeCambiarPassword == true). No hay forma de saltarla: solo
/// permite cerrar sesión o completar el cambio.
class CambiarPasswordObligatorioScreen extends StatefulWidget {
  const CambiarPasswordObligatorioScreen({super.key});

  @override
  State<CambiarPasswordObligatorioScreen> createState() =>
      _CambiarPasswordObligatorioScreenState();
}

class _CambiarPasswordObligatorioScreenState
    extends State<CambiarPasswordObligatorioScreen> {
  final _formKey = GlobalKey<FormState>();
  final _actualCtrl = TextEditingController();
  final _nuevaCtrl = TextEditingController();
  final _confirmarCtrl = TextEditingController();
  bool _verActual = false;
  bool _verNueva = false;
  bool _guardando = false;

  static const Color _muted = Color(0xFF6C8797);
  static const Color _label = Color(0xFF5B7A8B);
  static const Color _fieldFill = Color(0xFFEEF4F9);
  static const Color _fieldBorder = Color(0xFFDCE7EF);

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
      // AuthGate observa debeCambiarPassword y reconstruye esta ruta como
      // MainShell apenas el perfil se refresque: no hay nada que "pop-ear".
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

  Future<void> _cerrarSesion() async {
    final confirmar = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cerrar sesión'),
        content: const Text('¿Seguro que quieres salir de tu cuenta?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Salir'),
          ),
        ],
      ),
    );
    if (confirmar == true && mounted) {
      await context.read<AuthProvider>().logout();
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
          const HidroLogo(size: 72),
          const SizedBox(height: 14),
          const Text(
            'Crea tu contraseña',
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
              'Tu cuenta tiene una contraseña temporal',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: onSurface,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Por seguridad, debes reemplazarla por una nueva antes de continuar.',
              style: TextStyle(fontSize: 13.5, color: _muted, height: 1.4),
            ),
            const SizedBox(height: 22),
            _fieldLabel('CONTRASEÑA TEMPORAL'),
            TextFormField(
              controller: _actualCtrl,
              obscureText: !_verActual,
              textInputAction: TextInputAction.next,
              decoration: _decoration(
                hint: 'La que recibiste por correo',
                icon: Icons.lock_clock_outlined,
                suffix: IconButton(
                  splashRadius: 20,
                  icon: Icon(
                    _verActual
                        ? Icons.visibility_off_outlined
                        : Icons.visibility_outlined,
                    color: _muted,
                    size: 20,
                  ),
                  onPressed: () => setState(() => _verActual = !_verActual),
                ),
              ),
              validator: (v) =>
                  (v == null || v.isEmpty) ? 'Ingresa tu contraseña actual' : null,
            ),
            const SizedBox(height: 16),
            _fieldLabel('NUEVA CONTRASEÑA'),
            TextFormField(
              controller: _nuevaCtrl,
              obscureText: !_verNueva,
              textInputAction: TextInputAction.next,
              decoration: _decoration(
                hint: 'Mínimo 8 caracteres',
                icon: Icons.lock_outline,
                suffix: IconButton(
                  splashRadius: 20,
                  icon: Icon(
                    _verNueva
                        ? Icons.visibility_off_outlined
                        : Icons.visibility_outlined,
                    color: _muted,
                    size: 20,
                  ),
                  onPressed: () => setState(() => _verNueva = !_verNueva),
                ),
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
            _fieldLabel('CONFIRMAR NUEVA CONTRASEÑA'),
            TextFormField(
              controller: _confirmarCtrl,
              obscureText: !_verNueva,
              textInputAction: TextInputAction.done,
              onFieldSubmitted: (_) => _guardando ? null : _guardar(),
              decoration: _decoration(
                hint: 'Repite la nueva contraseña',
                icon: Icons.lock_outline,
              ),
              validator: (v) =>
                  v != _nuevaCtrl.text ? 'Las contraseñas no coinciden' : null,
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
                  : const Text('Guardar y continuar'),
            ),
            const SizedBox(height: 4),
            TextButton(
              onPressed: _guardando ? null : _cerrarSesion,
              style: TextButton.styleFrom(foregroundColor: AppTheme.danger),
              child: const Text('Cerrar sesión'),
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
