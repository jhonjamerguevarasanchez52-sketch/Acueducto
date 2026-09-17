import 'package:flutter/material.dart';

import '../screens/chat_screen.dart';
import 'gota_fab.dart';

/// `Scaffold` con el botón flotante del asistente "GOTA" ya incorporado.
///
/// Las pantallas internas (home, facturas, pagos, averías, etc.) usan este
/// widget en lugar de `Scaffold` para que el acceso al chat aparezca siempre
/// en el mismo sitio sin repetir código. Las pantallas de sesión (login,
/// bienvenida) y el propio chat siguen usando `Scaffold` normal.
///
/// Si la pantalla necesita su propio botón flotante, se pasa en
/// [floatingActionButton] y se muestra encima del de GOTA.
class GotaScaffold extends StatelessWidget {
  const GotaScaffold({
    super.key,
    this.appBar,
    required this.body,
    this.floatingActionButton,
    this.floatingActionButtonLocation,
    this.bottomNavigationBar,
    this.backgroundColor,
    this.resizeToAvoidBottomInset,
  });

  final PreferredSizeWidget? appBar;
  final Widget body;
  final Widget? floatingActionButton;
  final FloatingActionButtonLocation? floatingActionButtonLocation;
  final Widget? bottomNavigationBar;
  final Color? backgroundColor;
  final bool? resizeToAvoidBottomInset;

  void _abrirChat(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => const ChatScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    final gota = GotaFab(onTap: () => _abrirChat(context));

    return Scaffold(
      appBar: appBar,
      body: body,
      bottomNavigationBar: bottomNavigationBar,
      backgroundColor: backgroundColor,
      resizeToAvoidBottomInset: resizeToAvoidBottomInset,
      floatingActionButtonLocation: floatingActionButtonLocation,
      floatingActionButton: floatingActionButton == null
          ? gota
          : Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                floatingActionButton!,
                const SizedBox(height: 12),
                gota,
              ],
            ),
    );
  }
}
