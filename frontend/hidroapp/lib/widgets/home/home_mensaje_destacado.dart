import 'package:flutter/material.dart';

import '../../theme/app_theme.dart';

/// Mensaje que resalta en la pestaña "Inicio": banda con acento de color,
/// ícono y texto de bienvenida.
class HomeMensajeDestacado extends StatelessWidget {
  const HomeMensajeDestacado({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.surfaceTint,
        borderRadius: BorderRadius.circular(16),
        border: const Border(
          left: BorderSide(color: AppTheme.primary, width: 5),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: const [
          Icon(Icons.info_outline, color: AppTheme.primaryDark),
          SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Todo tu acueducto en un solo lugar',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: AppTheme.primaryDark,
                  ),
                ),
                SizedBox(height: 4),
                Text(
                  'Consulta tus facturas, registra pagos, reporta averías y '
                  'revisa el estado del servicio desde tu celular.',
                  style: TextStyle(fontSize: 13, height: 1.35),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
