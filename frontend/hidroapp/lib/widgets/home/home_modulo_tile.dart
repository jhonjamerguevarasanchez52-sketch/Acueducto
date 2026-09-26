import 'package:flutter/material.dart';

import '../../theme/app_theme.dart';
import '../core/app_snackbar.dart';

/// Atajo a un módulo desde la pestaña "Inicio". Si [destino] es `null`, el
/// módulo aún no está implementado y solo muestra un aviso.
class HomeModuloTile extends StatelessWidget {
  const HomeModuloTile({
    super.key,
    required this.icon,
    required this.label,
    this.destino,
  });

  final IconData icon;
  final String label;

  /// Constructor de la pantalla a la que navega el módulo.
  final Widget Function()? destino;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: Container(
          padding: const EdgeInsets.all(8),
          decoration: const BoxDecoration(
            color: AppTheme.surfaceTint,
            shape: BoxShape.circle,
          ),
          child: Icon(icon, color: AppTheme.primaryDark),
        ),
        title: Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
        trailing: const Icon(Icons.chevron_right, color: Colors.black38),
        onTap: () {
          final destino = this.destino;
          if (destino == null) {
            AppSnackbar.info(context, '"$label" estará disponible pronto');
            return;
          }
          Navigator.of(context).push(
            MaterialPageRoute<void>(builder: (_) => destino()),
          );
        },
      ),
    );
  }
}
