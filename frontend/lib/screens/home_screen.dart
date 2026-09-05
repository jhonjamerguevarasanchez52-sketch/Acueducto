import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../theme/app_theme.dart';

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

    return Scaffold(
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
        padding: const EdgeInsets.all(20),
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
          _ModuloTile(icon: Icons.receipt_long, label: 'Mis facturas'),
          _ModuloTile(icon: Icons.payments_outlined, label: 'Mis pagos'),
          _ModuloTile(icon: Icons.build_outlined, label: 'Averías'),
          _ModuloTile(
              icon: Icons.notifications_outlined, label: 'Notificaciones'),
          _ModuloTile(
              icon: Icons.water_drop_outlined, label: 'Estado del servicio'),
        ],
      ),
    );
  }
}

class _ModuloTile extends StatelessWidget {
  const _ModuloTile({required this.icon, required this.label});

  final IconData icon;
  final String label;

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
        onTap: () => ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('"$label" estará disponible pronto')),
        ),
      ),
    );
  }
}
