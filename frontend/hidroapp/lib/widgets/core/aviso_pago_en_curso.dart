import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../theme/app_theme.dart';

/// Reemplaza el botón "Pagar" cuando la factura ya tiene un pago por revisar
/// o en curso en Wompi. El servidor no acepta otro pago mientras tanto, así
/// que ofrecer el botón solo llevaba a un error.
class AvisoPagoEnCurso extends StatelessWidget {
  const AvisoPagoEnCurso({super.key});

  static const texto =
      'Ya tienes un pago en revisión o en curso para esta factura. '
      'Revisa su estado en "Mis pagos".';

  @override
  Widget build(BuildContext context) {
    final colores = AppColors.of(context);
    return Container(
      key: const Key('aviso_pago_en_curso'),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: colores.warning.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(LucideIcons.hourglass, size: 18, color: colores.warning),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              texto,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: colores.warning,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
