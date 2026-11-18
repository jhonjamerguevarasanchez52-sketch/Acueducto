import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';

/// Pantalla principal tras iniciar sesión. Por ahora muestra los datos del
/// perfil y sirve de base para los módulos (facturas, pagos, averías, etc.).
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final perfil = auth.profile;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Acueducto Campo Amor'),
        actions: [
          IconButton(
            tooltip: 'Cerrar sesión',
            icon: const Icon(Icons.logout),
            onPressed: () => context.read<AuthProvider>().logout(),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Card(
            child: ListTile(
              leading: const CircleAvatar(child: Icon(Icons.person)),
              title: Text(perfil?.nombreCompleto ?? 'Usuario'),
              subtitle: Text(
                '${perfil?.correo ?? ''}\nRol: ${perfil?.rol ?? '-'}',
              ),
              isThreeLine: true,
            ),
          ),
          const SizedBox(height: 24),
          Text('Módulos', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          _ModuloTile(icon: Icons.receipt_long, label: 'Mis facturas'),
          _ModuloTile(icon: Icons.payments_outlined, label: 'Mis pagos'),
          _ModuloTile(icon: Icons.build_outlined, label: 'Averías'),
          _ModuloTile(icon: Icons.notifications_outlined, label: 'Notificaciones'),
          _ModuloTile(icon: Icons.water_drop_outlined, label: 'Estado del servicio'),
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
        leading: Icon(icon),
        title: Text(label),
        trailing: const Icon(Icons.chevron_right),
        onTap: () => ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('"$label" estará disponible pronto')),
        ),
      ),
    );
  }
}
