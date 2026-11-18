import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../theme/app_theme.dart';
import 'dialogo_centrado.dart';

/// Ventana centrada para elegir cómo se paga una factura. Devuelve por
/// `Navigator.pop` el método elegido y una referencia opcional; quien la
/// invoca es el que registra el pago contra `POST /api/pagos`.
///
/// Se usa tanto desde "Mis facturas" (pagar una factura pendiente) como desde
/// "Mis pagos" (reintentar un pago pendiente o rechazado).
///
/// Es una ventana centrada (no una hoja inferior) para que el botón de pagar
/// nunca quede detrás de la barra de botones de Android.
Future<({String metodo, String? referencia})?> mostrarPagarSheet(
  BuildContext context, {
  required String subtitulo,
}) {
  return mostrarDialogoCentrado<({String metodo, String? referencia})>(
    context,
    builder: (_) => _PagarSheet(subtitulo: subtitulo),
  );
}

class _PagarSheet extends StatefulWidget {
  const _PagarSheet({required this.subtitulo});

  final String subtitulo;

  @override
  State<_PagarSheet> createState() => _PagarSheetState();
}

class _PagarSheetState extends State<_PagarSheet> {
  static const _metodos = <({String id, String nombre, IconData icono})>[
    (id: 'wompi', nombre: 'Pagar en línea con Wompi', icono: LucideIcons.lock),
    (id: 'fisico', nombre: 'Pago físico', icono: LucideIcons.receiptText),
  ];

  String _metodo = 'wompi';

  void _confirmar() {
    Navigator.of(context).pop((metodo: _metodo, referencia: null));
  }

  @override
  Widget build(BuildContext context) {
    final secundario = AppColors.of(context).secondaryText;
    return DialogoCentrado(
      titulo: 'Pagar factura',
      subtitulo: widget.subtitulo,
      contenido: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final metodo in _metodos)
            _MetodoTile(
              nombre: metodo.nombre,
              icono: metodo.icono,
              seleccionado: _metodo == metodo.id,
              onTap: () => setState(() => _metodo = metodo.id),
            ),
          const SizedBox(height: 6),
          Text(
            _metodo == 'wompi'
                ? 'Se abrirá el checkout seguro de Wompi para completar el pago.'
                : 'Selecciona una foto del comprobante para enviarla al acueducto.',
            style: TextStyle(fontSize: 12, color: secundario),
          ),
        ],
      ),
      acciones: [
        FilledButton(
          onPressed: _confirmar,
          child: Text(
            _metodo == 'wompi' ? 'Continuar con Wompi' : 'Subir recibo',
          ),
        ),
      ],
    );
  }
}

class _MetodoTile extends StatelessWidget {
  const _MetodoTile({
    required this.nombre,
    required this.icono,
    required this.seleccionado,
    required this.onTap,
  });

  final String nombre;
  final IconData icono;
  final bool seleccionado;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colores = AppColors.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: seleccionado ? colores.chipBackground : colores.cardBackground,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: seleccionado ? AppTheme.primary : colores.cardBorder,
                width: seleccionado ? 1.4 : 1,
              ),
            ),
            child: Row(
              children: [
                Icon(icono, size: 20, color: colores.info),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    nombre,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                Icon(
                  seleccionado ? LucideIcons.circleDot : LucideIcons.circle,
                  size: 20,
                  color: seleccionado
                      ? AppTheme.primary
                      : colores.secondaryText,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
