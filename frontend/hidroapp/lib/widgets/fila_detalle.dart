import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Fila de detalle "ícono + texto" usada en las tarjetas de los módulos
/// (facturas, pagos, cortes, estado del servicio). Un ícono pequeño en gris
/// y el texto al lado, con un pequeño margen superior para separarla de la
/// fila anterior.
class FilaDetalle extends StatelessWidget {
  const FilaDetalle({super.key, required this.icono, required this.texto});

  final IconData icono;
  final String texto;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icono, size: 15, color: AppTheme.secondaryText),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              texto,
              style: const TextStyle(
                fontSize: 13,
                color: AppTheme.secondaryText,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
