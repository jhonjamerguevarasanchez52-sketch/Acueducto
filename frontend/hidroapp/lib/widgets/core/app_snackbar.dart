import 'package:flutter/material.dart';

import '../../theme/app_theme.dart';

/// Avisos flotantes consistentes en toda la app: mismo formato (ícono +
/// color según el tipo) para no tener cada pantalla su propio `SnackBar` de
/// solo texto.
class AppSnackbar {
  AppSnackbar._();

  /// Algo falló (error de red, validación, respuesta del backend).
  static void error(BuildContext context, String mensaje) => _mostrar(
        context,
        mensaje,
        icono: Icons.error_outline,
        color: AppColors.of(context).danger,
      );

  /// Una acción se completó con éxito.
  static void success(BuildContext context, String mensaje) => _mostrar(
        context,
        mensaje,
        icono: Icons.check_circle_outline,
        color: AppColors.of(context).success,
      );

  /// Aviso neutro, sin implicar éxito ni error.
  static void info(BuildContext context, String mensaje) => _mostrar(
        context,
        mensaje,
        icono: Icons.info_outline,
        color: AppTheme.primaryDark,
      );

  static void _mostrar(
    BuildContext context,
    String mensaje, {
    required IconData icono,
    required Color color,
  }) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          backgroundColor: color,
          content: Row(
            children: [
              Icon(icono, color: Colors.white, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Text(mensaje, style: const TextStyle(color: Colors.white)),
              ),
            ],
          ),
        ),
      );
  }
}
