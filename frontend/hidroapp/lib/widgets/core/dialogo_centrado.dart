import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

/// Abre [builder] como una ventana centrada en la pantalla.
///
/// Los pagos se hacían en hojas inferiores, y en teléfonos con la barra de
/// tres botones de Android el botón "Pagar" quedaba debajo de esa barra y no
/// se podía tocar. Centrada, la ventana queda siempre lejos de los bordes.
Future<T?> mostrarDialogoCentrado<T>(
  BuildContext context, {
  required WidgetBuilder builder,
  bool cerrarAlTocarFuera = true,
}) {
  return showDialog<T>(
    context: context,
    barrierDismissible: cerrarAlTocarFuera,
    builder: builder,
  );
}

/// Ventana centrada con título, contenido desplazable y botones fijos abajo.
///
/// - Respeta las barras del sistema (barra de estado, barra de 3 botones o de
///   gestos) y el teclado, así nunca tapan los botones.
/// - Si el contenido es largo, se desplaza solo el contenido: los botones de
///   acción siempre se ven y se pueden tocar.
class DialogoCentrado extends StatelessWidget {
  const DialogoCentrado({
    super.key,
    required this.titulo,
    this.subtitulo,
    required this.contenido,
    this.acciones = const [],
    this.mostrarCerrar = true,
  });

  final String titulo;
  final String? subtitulo;
  final Widget contenido;

  /// Botones de acción; se apilan a lo ancho, el principal primero.
  final List<Widget> acciones;
  final bool mostrarCerrar;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    return SafeArea(
      minimum: const EdgeInsets.symmetric(vertical: 12),
      child: Dialog(
        insetPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 20),
        clipBehavior: Clip.antiAlias,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 480),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: EdgeInsets.fromLTRB(20, 18, mostrarCerrar ? 8 : 20, 4),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            titulo,
                            style: const TextStyle(
                              fontSize: 19,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          if (subtitulo != null) ...[
                            const SizedBox(height: 3),
                            Text(
                              subtitulo!,
                              style: TextStyle(
                                color: tema.colorScheme.onSurfaceVariant,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    if (mostrarCerrar)
                      IconButton(
                        tooltip: 'Cerrar',
                        onPressed: () => Navigator.of(context).maybePop(),
                        icon: const Icon(LucideIcons.x),
                      ),
                  ],
                ),
              ),
              Flexible(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
                  child: contenido,
                ),
              ),
              if (acciones.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      for (final (i, accion) in acciones.indexed) ...[
                        if (i > 0) const SizedBox(height: 10),
                        accion,
                      ],
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
