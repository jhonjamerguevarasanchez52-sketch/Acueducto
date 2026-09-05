import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'providers/auth_provider.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'screens/welcome_screen.dart';
import 'theme/app_theme.dart';

void main() {
  runApp(const AcueductoApp());
}

class AcueductoApp extends StatelessWidget {
  const AcueductoApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => AuthProvider()..bootstrap(),
      child: MaterialApp(
        title: 'Acueducto Campo Amor',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light,
        // Splash animado; al terminar navega a AuthGate, que decide entre el
        // login (sin sesión) y la pantalla principal (con sesión guardada).
        home: const WelcomeScreen(nextRoute: AuthGate()),
      ),
    );
  }
}

/// Decide qué mostrar según el estado de la sesión, una vez pasado el splash.
class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    final status = context.watch<AuthProvider>().status;

    switch (status) {
      case AuthStatus.unknown:
        return const Scaffold(
          body: Center(child: CircularProgressIndicator()),
        );
      case AuthStatus.authenticated:
        return const HomeScreen();
      case AuthStatus.unauthenticated:
        return const LoginScreen();
    }
  }
}
