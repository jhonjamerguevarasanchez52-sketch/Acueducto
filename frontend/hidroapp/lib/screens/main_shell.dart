import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../theme/app_theme.dart';
import 'averias_screen.dart';
import 'facturas_screen.dart';
import 'home_screen.dart';
import 'notificaciones_screen.dart';
import 'perfil_screen.dart';

/// Contenedor principal de la app tras iniciar sesión: mantiene la navegación
/// inferior fija y va mostrando cada módulo en su pestaña. Las pantallas
/// conservan su propia estructura (cabecera, listas, etc.); esta capa solo
/// añade la barra de abajo y recuerda en qué pestaña está el usuario.
class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> with WidgetsBindingObserver {
  int _indice = 0;
  int _versionAverias = 0;
  int _versionNotificaciones = 0;

  List<Widget> get _pantallas => [
        const HomeScreen(),
        const FacturasScreen(),
        AveriasScreen(key: ValueKey('averias-$_versionAverias')),
        NotificacionesScreen(
          key: ValueKey('notificaciones-$_versionNotificaciones'),
        ),
        const PerfilScreen(),
      ];

  static const _iconos = [
    (Icons.home_outlined, Icons.home, 'Inicio'),
    (Icons.receipt_long_outlined, Icons.receipt_long, 'Factura'),
    (Icons.build_outlined, Icons.build, 'Averías'),
    (Icons.notifications_outlined, Icons.notifications, 'Avisos'),
    (Icons.person_outline, Icons.person, 'Perfil'),
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed) return;
    _refrescarAccesoYDatos();
  }

  Future<void> _refrescarAccesoYDatos() async {
    try {
      await context.read<AuthProvider>().refreshProfile();
    } catch (_) {
      // La pantalla conserva sus datos si el perfil no se pudo refrescar;
      // el siguiente acceso volverá a intentarlo.
    }
    if (!mounted) return;
    setState(() {
      _versionAverias++;
      _versionNotificaciones++;
    });
  }

  Future<void> _seleccionarPestana(int indice) async {
    if (indice == 2) {
      try {
        // El rol define si se consulta la lista propia o la global y si se
        // muestra Reportar. Lo refrescamos antes de crear la pantalla.
        await context.read<AuthProvider>().refreshProfile();
      } catch (_) {
        // Si falla la red, mantenemos el rol que ya estaba cargado.
      }
    }
    if (!mounted) return;
    setState(() {
      if (indice == 2) _versionAverias++;
      if (indice == 3) _versionNotificaciones++;
      _indice = indice;
    });
  }

  // Construidos en cada build (en vez de una lista const) para poder darle a
  // cada ícono un pequeño rebote cuando su pestaña queda seleccionada.
  List<NavigationDestination> get _destinos => [
        for (final (i, datos) in _iconos.indexed)
          NavigationDestination(
            icon: _IconoConRebote(icono: datos.$1, activo: _indice == i),
            selectedIcon: _IconoConRebote(icono: datos.$2, activo: true),
            label: datos.$3,
          ),
      ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _indice, children: _pantallas),
      bottomNavigationBar: DecoratedBox(
        decoration: BoxDecoration(
          border: Border(top: BorderSide(color: AppColors.of(context).cardBorder)),
        ),
        child: NavigationBar(
          selectedIndex: _indice,
          onDestinationSelected: _seleccionarPestana,
          destinations: _destinos,
        ),
      ),
    );
  }
}

/// Ícono de la barra inferior con un pequeño rebote (escala) al quedar
/// seleccionado, en vez del cambio instantáneo por defecto.
class _IconoConRebote extends StatelessWidget {
  const _IconoConRebote({required this.icono, required this.activo});

  final IconData icono;
  final bool activo;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 1, end: activo ? 1.18 : 1.0),
      duration: const Duration(milliseconds: 260),
      curve: Curves.elasticOut,
      builder: (context, escala, child) =>
          Transform.scale(scale: escala, child: child),
      child: Icon(icono),
    );
  }
}
