import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Colores que sí cambian entre modo claro y oscuro (texto secundario,
/// fondo/borde de tarjetas "a medida" que no usan el widget `Card`, y los
/// colores de estado). Se registra como `ThemeExtension` para poder leerlo
/// con `AppColors.of(context)` desde cualquier widget.
@immutable
class AppColors extends ThemeExtension<AppColors> {
  const AppColors({
    required this.secondaryText,
    required this.cardBackground,
    required this.cardBorder,
    required this.chipBackground,
    required this.success,
    required this.warning,
    required this.danger,
    required this.info,
  });

  final Color secondaryText;
  final Color cardBackground;
  final Color cardBorder;
  final Color chipBackground;
  final Color success;
  final Color warning;
  final Color danger;
  final Color info;

  static AppColors of(BuildContext context) =>
      Theme.of(context).extension<AppColors>()!;

  static const light = AppColors(
    secondaryText: Colors.black54,
    cardBackground: Colors.white,
    cardBorder: Color(0xFFE3EEF4),
    chipBackground: Color(0xFFEAF5FB),
    success: Color(0xFF2E7D32),
    warning: Color(0xFFE65100),
    danger: Color(0xFFC62828),
    info: AppTheme.primaryDark,
  );

  static const dark = AppColors(
    secondaryText: Color(0xFFA9C0CE),
    cardBackground: Color(0xFF13232D),
    cardBorder: Color(0xFF24404E),
    chipBackground: Color(0xFF16262F),
    success: Color(0xFF66BB6A),
    warning: Color(0xFFFFA657),
    danger: Color(0xFFEF5350),
    info: Color(0xFF4FC3F7),
  );

  @override
  AppColors copyWith({
    Color? secondaryText,
    Color? cardBackground,
    Color? cardBorder,
    Color? chipBackground,
    Color? success,
    Color? warning,
    Color? danger,
    Color? info,
  }) {
    return AppColors(
      secondaryText: secondaryText ?? this.secondaryText,
      cardBackground: cardBackground ?? this.cardBackground,
      cardBorder: cardBorder ?? this.cardBorder,
      chipBackground: chipBackground ?? this.chipBackground,
      success: success ?? this.success,
      warning: warning ?? this.warning,
      danger: danger ?? this.danger,
      info: info ?? this.info,
    );
  }

  @override
  AppColors lerp(ThemeExtension<AppColors>? other, double t) {
    if (other is! AppColors) return this;
    return AppColors(
      secondaryText: Color.lerp(secondaryText, other.secondaryText, t)!,
      cardBackground: Color.lerp(cardBackground, other.cardBackground, t)!,
      cardBorder: Color.lerp(cardBorder, other.cardBorder, t)!,
      chipBackground: Color.lerp(chipBackground, other.chipBackground, t)!,
      success: Color.lerp(success, other.success, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      danger: Color.lerp(danger, other.danger, t)!,
      info: Color.lerp(info, other.info, t)!,
    );
  }
}

/// Paleta y tema base de la app del Acueducto Campo Amor.
class AppTheme {
  AppTheme._();

  static const Color primary = Color(0xFF0277BD); // azul agua
  static const Color primaryDark = Color(0xFF01579B);
  static const Color accent = Color(0xFF4FC3F7);
  static const Color surfaceTint = Color(0xFFEAF5FB);

  // Ítems sin seleccionar de la barra inferior: un azul apagado en vez del gris
  // por defecto, para que la barra no se vea "muerta".
  static const Color _navInactivo = Color(0xFF6B8CA3);

  /// Radio de esquina de los campos de formulario (inputs, botones).
  static const double fieldRadius = 14.0;

  /// Radio de esquina compartido por las tarjetas de listas (facturas,
  /// averías, pagos, notificaciones...), para no repetir el mismo número en
  /// cada widget.
  static const double cardRadius = 18.0;

  /// Duración estándar de las animaciones de entrada (fundido + deslizado)
  /// de tarjetas, cabeceras y títulos de AppBar.
  static const Duration motionEntrada = Duration(milliseconds: 380);

  /// Separación entre la entrada de un ítem de una lista y el siguiente,
  /// para que aparezcan en cascada en vez de todos de golpe. Se multiplica
  /// por el índice del ítem: `AppTheme.motionEscalon * i`.
  static const Duration motionEscalon = Duration(milliseconds: 40);

  // Paleta extendida, compartida por el splash y las cabeceras.
  static const Color midBlue = Color(0xFF1E5FA0);
  static const Color deepBlue = Color(0xFF0A3665);
  static const Color iceBlue = Color(0xFFDCEFF5);
  static const Color skyText = Color(0xFFB5D4F4);

  static ThemeData get light => _build(Brightness.light);

  /// Tema oscuro: mismas formas, radios y duraciones que el claro, solo
  /// cambian los colores de superficie (fondo, tarjetas, inputs, barra
  /// inferior). Las cabeceras con degradado propio (`HidroAppBar`,
  /// `HomeCabecera`, el splash) mantienen su azul de marca en ambos modos
  /// a propósito.
  static ThemeData get dark => _build(Brightness.dark);

  static ThemeData _build(Brightness brightness) {
    final esOscuro = brightness == Brightness.dark;

    final scheme = ColorScheme.fromSeed(
      seedColor: primary,
      primary: esOscuro ? accent : primary,
      brightness: brightness,
    );

    final fondoScaffold =
        esOscuro ? const Color(0xFF0D1B24) : const Color(0xFFF6FAFD);
    final fondoTarjeta = esOscuro ? const Color(0xFF13232D) : Colors.white;
    final bordeSutil =
        esOscuro ? const Color(0xFF24404E) : const Color(0xFFE3EEF4);
    final fondoCampo = esOscuro ? const Color(0xFF16262F) : surfaceTint;
    final fondoNavBar = esOscuro ? const Color(0xFF0F1E27) : Colors.white;
    final navInactivo = esOscuro ? const Color(0xFF6E8AA0) : _navInactivo;
    final navSeleccionado = esOscuro ? accent : primary;
    final labelColor = esOscuro ? const Color(0xFF9FB7C4) : const Color(0xFF5B7A8C);

    // Nunito: redondeada y amigable, pero todavía legible/seria para una app
    // de servicios. Se aplica a todo el árbol de texto (Text sin fontFamily
    // propio hereda de aquí), así que reviste toda la app de una sola vez.
    final textTheme = GoogleFonts.nunitoTextTheme(
      (esOscuro ? ThemeData.dark() : ThemeData.light()).textTheme,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: scheme,
      textTheme: textTheme,
      scaffoldBackgroundColor: fondoScaffold,
      // Misma transición (fundido + avance suave) en Android e iOS, en vez
      // del "zoom" seco por defecto de Android: se siente más fluida al
      // navegar entre pantallas.
      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          TargetPlatform.android: FadeForwardsPageTransitionsBuilder(),
          TargetPlatform.iOS: FadeForwardsPageTransitionsBuilder(),
        },
      ),
      appBarTheme: AppBarTheme(
        centerTitle: true,
        backgroundColor: primary,
        foregroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        titleTextStyle: GoogleFonts.nunito(
          fontSize: 20,
          fontWeight: FontWeight.w800,
          color: Colors.white,
          letterSpacing: 0.2,
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(52),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(fieldRadius),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(52),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(fieldRadius),
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: esOscuro ? accent : primaryDark,
          textStyle: const TextStyle(fontWeight: FontWeight.w600),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: fondoCampo,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(fieldRadius),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(fieldRadius),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(fieldRadius),
          borderSide: BorderSide(color: navSeleccionado, width: 1.6),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(fieldRadius),
          borderSide: BorderSide(color: scheme.error, width: 1.2),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(fieldRadius),
          borderSide: BorderSide(color: scheme.error, width: 1.6),
        ),
        labelStyle: TextStyle(color: labelColor),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        margin: const EdgeInsets.only(bottom: 12),
        color: fondoTarjeta,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(cardRadius),
          side: BorderSide(color: bordeSutil),
        ),
      ),
      listTileTheme: ListTileThemeData(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(cardRadius),
        ),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      ),
      navigationBarTheme: NavigationBarThemeData(
        height: 66,
        backgroundColor: fondoNavBar,
        elevation: 3,
        surfaceTintColor: Colors.transparent,
        indicatorColor: accent.withValues(alpha: esOscuro ? 0.22 : 0.30),
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        iconTheme: WidgetStateProperty.resolveWith((states) {
          final seleccionado = states.contains(WidgetState.selected);
          return IconThemeData(
            size: 26,
            color: seleccionado ? navSeleccionado : navInactivo,
          );
        }),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final seleccionado = states.contains(WidgetState.selected);
          return TextStyle(
            fontSize: 11.5,
            fontWeight: seleccionado ? FontWeight.w700 : FontWeight.w600,
            color: seleccionado
                ? (esOscuro ? accent : primaryDark)
                : navInactivo,
          );
        }),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
      ),
      dividerTheme: DividerThemeData(
        color: bordeSutil,
        thickness: 1,
      ),
      extensions: [esOscuro ? AppColors.dark : AppColors.light],
    );
  }
}
