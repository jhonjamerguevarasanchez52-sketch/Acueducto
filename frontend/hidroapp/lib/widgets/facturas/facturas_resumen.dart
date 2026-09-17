import 'package:flutter/material.dart';

import '../../theme/app_theme.dart';
import '../../utils/formato.dart';

/// Cabecera del módulo "Mis facturas": tarjeta azul con el saldo pendiente
/// total y cuántas facturas quedan por pagar, o un "Estás al día" si no hay
/// nada pendiente.
class FacturasResumen extends StatelessWidget {
  const FacturasResumen({
    super.key,
    required this.cantidadPendiente,
    required this.totalPendiente,
  });

  final int cantidadPendiente;
  final double totalPendiente;

  @override
  Widget build(BuildContext context) {
    final alDia = cantidadPendiente == 0;
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppTheme.midBlue, AppTheme.deepBlue],
        ),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            alDia ? 'Estás al día' : 'Saldo pendiente',
            style: const TextStyle(
              color: Colors.white70,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            alDia ? '\$ 0' : Formato.pesos(totalPendiente),
            style: const TextStyle(
              color: Colors.white,
              fontSize: 26,
              fontWeight: FontWeight.w800,
            ),
          ),
          if (!alDia) ...[
            const SizedBox(height: 4),
            Text(
              cantidadPendiente == 1
                  ? '1 factura por pagar'
                  : '$cantidadPendiente facturas por pagar',
              style: const TextStyle(color: Colors.white70, fontSize: 13),
            ),
          ],
        ],
      ),
    );
  }
}
