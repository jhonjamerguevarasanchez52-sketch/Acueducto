import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/gota_scaffold.dart';
import 'editar_perfil_screen.dart';

/// Pestaña "Perfil": muestra los datos de la cuenta del usuario, permite
/// editarlos (una vez cada 30 días) y cerrar sesión.
class PerfilScreen extends StatelessWidget {
  const PerfilScreen({super.key});

  Future<void> _editarPerfil(BuildContext context) async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const EditarPerfilScreen()),
    );
  }

  Future<void> _cerrarSesion(BuildContext context) async {
    final confirmar = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cerrar sesión'),
        content: const Text('¿Seguro que quieres salir de tu cuenta?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Salir'),
          ),
        ],
      ),
    );
    if (confirmar != true || !context.mounted) return;

    try {
      await context.read<AuthProvider>().logout();
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No se pudo cerrar sesión. Intenta de nuevo.')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final perfil = context.watch<AuthProvider>().profile;
    final textTheme = Theme.of(context).textTheme;

    return GotaScaffold(
      appBar: AppBar(title: const Text('Mi perfil')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Center(
            child: Column(
              children: [
                CircleAvatar(
                  radius: 40,
                  backgroundColor: AppTheme.surfaceTint,
                  child: const Icon(Icons.person,
                      color: Color.fromARGB(255, 91, 153, 247), size: 44),
                ),
                const SizedBox(height: 12),
                Text(
                  perfil?.nombreCompleto ?? 'Usuario',
                  style: textTheme.titleLarge
                      ?.copyWith(fontWeight: FontWeight.w800),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 4),
                Text(
                  perfil?.correo ?? '',
                  style: const TextStyle(color: AppTheme.secondaryText),
                ),
                const SizedBox(height: 8),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                  decoration: BoxDecoration(
                    color: AppTheme.surfaceTint,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    (perfil?.rol ?? '-').toUpperCase(),
                    style: const TextStyle(
                      color: AppTheme.primaryDark,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 28),
          Card(
            child: Column(
              children: [
                _Dato(
                  icono: Icons.badge_outlined,
                  etiqueta: 'Número de lote',
                  valor: perfil?.numeroLote,
                ),
                const Divider(height: 1),
                _Dato(
                  icono: Icons.location_on_outlined,
                  etiqueta: 'Dirección',
                  valor: perfil?.direccion,
                ),
                const Divider(height: 1),
                _Dato(
                  icono: Icons.map_outlined,
                  etiqueta: 'Zona',
                  valor: perfil?.zona,
                ),
                const Divider(height: 1),
                _Dato(
                  icono: Icons.phone_outlined,
                  etiqueta: 'Teléfono',
                  valor: perfil?.telefono,
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          OutlinedButton.icon(
            onPressed: () => _editarPerfil(context),
            icon: const Icon(Icons.edit_outlined),
            label: const Text('Editar perfil'),
          ),
          const SizedBox(height: 8),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 4),
            child: Text(
              'Solo puedes editar tus datos una vez cada 30 días.',
              style: TextStyle(color: AppTheme.secondaryText, fontSize: 12),
            ),
          ),
          const SizedBox(height: 16),
          OutlinedButton.icon(
            onPressed: () => _cerrarSesion(context),
            icon: const Icon(Icons.logout),
            label: const Text('Cerrar sesión'),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppTheme.danger,
              side: const BorderSide(color: AppTheme.danger),
            ),
          ),
        ],
      ),
    );
  }
}

class _Dato extends StatelessWidget {
  const _Dato({required this.icono, required this.etiqueta, this.valor});

  final IconData icono;
  final String etiqueta;
  final String? valor;

  @override
  Widget build(BuildContext context) {
    final texto = (valor == null || valor!.trim().isEmpty) ? 'Sin registrar' : valor!;
    final sinDato = texto == 'Sin registrar';
    return ListTile(
      leading: Icon(icono, color: AppTheme.primaryDark),
      title: Text(etiqueta, style: const TextStyle(fontSize: 13, color: AppTheme.secondaryText)),
      subtitle: Text(
        texto,
        style: TextStyle(
          fontSize: 15,
          fontWeight: FontWeight.w600,
          color: sinDato ? AppTheme.secondaryText : Colors.black87,
        ),
      ),
    );
  }
}
