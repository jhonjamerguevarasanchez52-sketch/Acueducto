import 'package:flutter/material.dart';

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

class _MainShellState extends State<MainShell> {
  int _indice = 0;

  static const _pantallas = <Widget>[
    HomeScreen(),
    FacturasScreen(),
    AveriasScreen(),
    NotificacionesScreen(),
    PerfilScreen(),
  ];

  static const _destinos = <NavigationDestination>[
    NavigationDestination(
      icon: Icon(Icons.home_outlined),
      selectedIcon: Icon(Icons.home),
      label: 'Inicio',
    ),
    NavigationDestination(
      icon: Icon(Icons.receipt_long_outlined),
      selectedIcon: Icon(Icons.receipt_long),
      label: 'Factura',
    ),
    NavigationDestination(
      icon: Icon(Icons.build_outlined),
      selectedIcon: Icon(Icons.build),
      label: 'Averías',
    ),
    NavigationDestination(
      icon: Icon(Icons.notifications_outlined),
      selectedIcon: Icon(Icons.notifications),
      label: 'Avisos',
    ),
    NavigationDestination(
      icon: Icon(Icons.person_outline),
      selectedIcon: Icon(Icons.person),
      label: 'Perfil',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _indice, children: _pantallas),
      bottomNavigationBar: DecoratedBox(
        decoration: const BoxDecoration(
          border: Border(top: BorderSide(color: Color(0xFFE3EEF4))),
        ),
        child: NavigationBar(
          selectedIndex: _indice,
          onDestinationSelected: (i) => setState(() => _indice = i),
          destinations: _destinos,
        ),
      ),
    );
  }
}
