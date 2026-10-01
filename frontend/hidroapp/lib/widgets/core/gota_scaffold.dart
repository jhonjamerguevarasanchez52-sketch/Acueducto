import 'package:flutter/material.dart';

import '../../screens/chat_screen.dart';
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
class GotaScaffold extends StatefulWidget {
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

  @override
  State<GotaScaffold> createState() => _GotaScaffoldState();
}

class _GotaScaffoldState extends State<GotaScaffold> {
  Offset? _gotaPosition;
  Offset? _arrastreOrigen;

  void _abrirChat(BuildContext context) {
    Navigator.of(
      context,
    ).push(MaterialPageRoute<void>(builder: (_) => const ChatScreen()));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: widget.appBar,
      body: LayoutBuilder(
        builder: (context, constraints) {
          const tamano = 68.0;
          const margen = 12.0;
          final anchoMaximo = (constraints.maxWidth - tamano - margen)
              .clamp(margen, double.infinity)
              .toDouble();
          final altoMaximo = (constraints.maxHeight - tamano - margen)
              .clamp(margen, double.infinity)
              .toDouble();
          final posicionInicial = Offset(
            anchoMaximo,
            (constraints.maxHeight -
                    tamano -
                    (widget.floatingActionButton == null ? margen : 96))
                .clamp(margen, altoMaximo)
                .toDouble(),
          );
          final posicion = Offset(
            (_gotaPosition?.dx ?? posicionInicial.dx)
                .clamp(margen, anchoMaximo)
                .toDouble(),
            (_gotaPosition?.dy ?? posicionInicial.dy)
                .clamp(margen, altoMaximo)
                .toDouble(),
          );

          return Stack(
            clipBehavior: Clip.hardEdge,
            children: [
              Positioned.fill(child: widget.body),
              Positioned(
                left: posicion.dx,
                top: posicion.dy,
                child: GotaFab(
                  onTap: () => _abrirChat(context),
                  onDragStart: () => _arrastreOrigen = posicion,
                  onDragUpdate: (delta) => setState(() {
                    final origen = _arrastreOrigen ?? posicion;
                    _gotaPosition = Offset(
                      (origen.dx + delta.dx)
                          .clamp(margen, anchoMaximo)
                          .toDouble(),
                      (origen.dy + delta.dy)
                          .clamp(margen, altoMaximo)
                          .toDouble(),
                    );
                  }),
                  onDragEnd: () => _arrastreOrigen = null,
                ),
              ),
            ],
          );
        },
      ),
      bottomNavigationBar: widget.bottomNavigationBar,
      backgroundColor: widget.backgroundColor,
      resizeToAvoidBottomInset: widget.resizeToAvoidBottomInset,
      floatingActionButtonLocation: widget.floatingActionButtonLocation,
      floatingActionButton: widget.floatingActionButton,
    );
  }
}
