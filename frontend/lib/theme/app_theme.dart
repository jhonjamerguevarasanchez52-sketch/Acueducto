import 'package:flutter/material.dart';

/// Paleta y tema base de la app del Acueducto Campo Amor.
class AppTheme {
  AppTheme._();

  static const Color primary = Color(0xFF0277BD); // azul agua
  static const Color primaryDark = Color(0xFF01579B);
  static const Color accent = Color(0xFF4FC3F7);

  static ThemeData get light {
    final scheme = ColorScheme.fromSeed(
      seedColor: primary,
      primary: primary,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: const Color(0xFFF6FAFD),
      appBarTheme: const AppBarTheme(
        centerTitle: true,
        backgroundColor: primary,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(52),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(52),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
      ),
    );
  }
}
