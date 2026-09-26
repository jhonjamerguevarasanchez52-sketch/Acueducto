import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'providers/auth_provider.dart';
import 'providers/theme_provider.dart';
import 'screens/cambiar_password_obligatorio_screen.dart';
import 'screens/login_screen.dart';
import 'screens/main_shell.dart';
import 'screens/welcome_screen.dart';
import 'theme/app_theme.dart';

void main() {
  runApp(const AcueductoApp());
}

class AcueductoApp extends StatelessWidget {
  const AcueductoApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()..bootstrap()),
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
      ],
      child: Builder(
        builder: (context) {
          final temaProvider = context.watch<ThemeProvider>();
          return MaterialApp(
            title: 'Acueducto Campo Amor',
            debugShowCheckedModeBanner: false,
            theme: AppTheme.light,
            darkTheme: AppTheme.dark,
            themeMode: temaProvider.modo,
            // Splash animado; al terminar navega a AuthGate, que decide entre
            // el login (sin sesión) y la pantalla principal (con sesión
            // guardada).
            home: const WelcomeScreen(nextRoute: AuthGate()),
          );
        },
      ),
    );
  }
}

/// Decide qué mostrar según el estado de la sesión, una vez pasado el splash.
class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    switch (auth.status) {
      case AuthStatus.unknown:
        return const Scaffold(
          body: Center(child: CircularProgressIndicator()),
        );
      case AuthStatus.authenticated:
        // Cuentas creadas por un administrador (incluye siempre al
        // fontanero, que nunca se autorregistra) arrancan con una
        // contraseña temporal: no dejamos pasar a la app hasta cambiarla.
        return auth.debeCambiarPassword
            ? const CambiarPasswordObligatorioScreen()
            : const MainShell();
      case AuthStatus.unauthenticated:
        return const LoginScreen();
    }
  }
}
