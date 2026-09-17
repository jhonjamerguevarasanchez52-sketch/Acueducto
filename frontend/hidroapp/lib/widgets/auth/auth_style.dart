import 'package:flutter/material.dart';

import '../../theme/app_theme.dart';

/// Colores y helpers compartidos por las pantallas de sesión (login y
/// verificación de cuenta): la cabecera azul, la tarjeta blanca y los campos
/// del formulario tienen el mismo aspecto en ambas.

const Color authMuted = Color(0xFF6C8797);
const Color authLabel = Color(0xFF5B7A8B);
const Color authFieldFill = Color(0xFFEEF4F9);
const Color authFieldBorder = Color(0xFFDCE7EF);

/// Cabecera azul con degradado y esquinas inferiores redondeadas. El contenido
/// (logo, títulos, botón de volver…) lo pone cada pantalla en [child].
class AuthHeader extends StatelessWidget {
  const AuthHeader({super.key, required this.child, this.topExtra = 36});

  final Widget child;
  final double topExtra;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.fromLTRB(
        24,
        MediaQuery.of(context).padding.top + topExtra,
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
      child: child,
    );
  }
}

/// Tarjeta blanca redondeada con sombra donde vive el formulario.
class AuthCard extends StatelessWidget {
  const AuthCard({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
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
      child: child,
    );
  }
}

/// Etiqueta pequeña en mayúsculas que va encima de cada campo.
Widget authFieldLabel(String text) => Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        text,
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.8,
          color: authLabel,
        ),
      ),
    );

/// `InputDecoration` común a los campos de las pantallas de sesión.
InputDecoration authInputDecoration({
  required String hint,
  IconData? icon,
  Widget? suffix,
  TextStyle? hintStyle,
  String? counterText,
}) {
  OutlineInputBorder border(Color color, [double width = 1]) =>
      OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: color, width: width),
      );

  return InputDecoration(
    hintText: hint,
    counterText: counterText,
    hintStyle: hintStyle ?? const TextStyle(color: Color(0xFF9FB4C2)),
    prefixIcon: icon == null
        ? null
        : Icon(icon, color: AppTheme.primary, size: 20),
    suffixIcon: suffix,
    filled: true,
    fillColor: authFieldFill,
    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
    enabledBorder: border(authFieldBorder),
    focusedBorder: border(AppTheme.primary, 1.6),
    errorBorder: border(const Color(0xFFD9534F)),
    focusedErrorBorder: border(const Color(0xFFD9534F), 1.6),
  );
}
