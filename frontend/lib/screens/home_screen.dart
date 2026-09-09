import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/gota_scaffold.dart';
import 'averias_screen.dart';
import 'estado_servicio_screen.dart';
import 'facturas_screen.dart';
import 'notificaciones_screen.dart';
import 'pagos_screen.dart';

/// Pantalla principal tras iniciar sesión. Por ahora muestra los datos del
/// perfil y sirve de base para los módulos (facturas, pagos, averías, etc.).
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  Future<void> _cerrarSesion(BuildContext context) async {
    try {
      await context.read<AuthProvider>().logout();
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No se pudo cerrar sesión. Intenta de nuevo.')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final perfil = auth.profile;
    final textTheme = Theme.of(context).textTheme;

    return GotaScaffold(
      appBar: AppBar(
        title: const Text('Acueducto Campo Amor'),
        actions: [
          IconButton(
            tooltip: 'Cerrar sesión',
            icon: const Icon(Icons.logout),
            onPressed: () => _cerrarSesion(context),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 96),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 28,
                    backgroundColor: AppTheme.surfaceTint,
                    child: const Icon(Icons.person,
                        color: AppTheme.primaryDark, size: 30),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          perfil?.nombreCompleto ?? 'Usuario',
                          style: textTheme.titleMedium
                              ?.copyWith(fontWeight: FontWeight.w700),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          perfil?.correo ?? '',
                          style: const TextStyle(color: AppTheme.secondaryText),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: AppTheme.surfaceTint,
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            perfil?.rol ?? '-',
                            style: const TextStyle(
                              color: AppTheme.primaryDark,
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),
          Text('Módulos',
              style:
                  textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 12),
          _ModuloTile(
            icon: Icons.receipt_long,
            label: 'Mis facturas',
            destino: () => const FacturasScreen(),
          ),
          _ModuloTile(
            icon: Icons.payments_outlined,
            label: 'Mis pagos',
            destino: () => const PagosScreen(),
          ),
          _ModuloTile(
            icon: Icons.build_outlined,
            label: 'Averías',
            destino: () => const AveriasScreen(),
          ),
          _ModuloTile(
            icon: Icons.notifications_outlined,
            label: 'Notificaciones',
            destino: () => const NotificacionesScreen(),
          ),
          _ModuloTile(
            icon: Icons.water_drop_outlined,
            label: 'Estado del servicio',
            destino: () => const EstadoServicioScreen(),
          ),
        ],
      ),
    );
  }
}

class _ModuloTile extends StatelessWidget {
  const _ModuloTile({
    required this.icon,
    required this.label,
    this.destino,
  });

  final IconData icon;
  final String label;

  /// Constructor de la pantalla a la que navega el módulo. Si es `null`, el
  /// módulo aún no está implementado y solo muestra un aviso.
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
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('"$label" estará disponible pronto')),
            );
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
