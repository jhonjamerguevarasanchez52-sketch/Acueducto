import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'admin_api.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

class AdminPagosScreen extends StatefulWidget {
  const AdminPagosScreen({super.key, required this.api});
  final AdminApi api;

  @override
  State<AdminPagosScreen> createState() => _AdminPagosScreenState();
}

class _AdminPagosScreenState extends State<AdminPagosScreen> {
  late Future<List<Map<String, dynamic>>> _futuro;

  Future<void> _verRecibo(String url) async {
    final uri = Uri.tryParse(url);
    final abierto = uri != null &&
        await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!abierto && mounted) _aviso('No se pudo abrir el recibo.');
  }

  @override
  void initState() {
    super.initState();
    _futuro = widget.api.pagosSinConfirmar();
  }

  void _recargar() => setState(() {
    _futuro = widget.api.pagosSinConfirmar();
  });

  void _aviso(String texto) => ScaffoldMessenger.of(
    context,
  ).showSnackBar(SnackBar(content: Text(texto)));

  Future<void> _confirmar(Map<String, dynamic> p) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        scrollable: true,
        title: const Text('Confirmar pago'),
        content: Text(
          'Monto: \$${p['monto']}\n'
          'Método: ${p['metodo']}\n'
          'Referencia: ${p['referencia'] ?? '-'}\n\n'
          'Al confirmar, la factura queda pagada y se reconecta el servicio si estaba cortado.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Confirmar'),
          ),
        ],
      ),
    );
    if (ok != true) return;

    try {
      await widget.api.confirmarPago(p['id'] as String);
      if (!mounted) return;
      _aviso('Pago confirmado');
      _recargar();
    } catch (e) {
      if (!mounted) return;
      _aviso('$e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Recibos por revisar')),
      body: FutureBuilder<List<Map<String, dynamic>>>(
        future: _futuro,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) return Center(child: Text('${snap.error}'));

          final pagos = snap.data!;
          if (pagos.isEmpty) {
            return const Center(child: Text('No hay recibos por revisar'));
          }

          return RefreshIndicator(
            onRefresh: () async => _recargar(),
            child: ListView.builder(
              itemCount: pagos.length,
              itemBuilder: (_, i) {
                final p = pagos[i];
                final recibo = p['recibo_url'];
                return ListTile(
                  leading: const Icon(LucideIcons.hourglass),
                  title: Text('\$${p['monto']} · ${p['metodo']}'),
                  subtitle: Text(
                    recibo is String && recibo.isNotEmpty
                        ? 'Toca para ver el recibo'
                        : 'Sin imagen del recibo',
                  ),
                  onTap: recibo is String && recibo.isNotEmpty
                      ? () => _verRecibo(recibo)
                      : null,
                  trailing: FilledButton(
                    // El tema da ancho infinito a los botones; en una fila
                    // de lista eso rompe el diseño.
                    style: FilledButton.styleFrom(
                      minimumSize: const Size(0, 40),
                    ),
                    onPressed: () => _confirmar(p),
                    child: const Text('Confirmar'),
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}
