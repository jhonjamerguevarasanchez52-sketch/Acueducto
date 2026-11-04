import 'package:flutter/material.dart';
import 'admin_api.dart';

class AdminPagosScreen extends StatefulWidget {
  const AdminPagosScreen({super.key, required this.api});
  final AdminApi api;

  @override
  State<AdminPagosScreen> createState() => _AdminPagosScreenState();
}

class _AdminPagosScreenState extends State<AdminPagosScreen> {
  late Future<List<dynamic>> _futuro;

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
      appBar: AppBar(title: const Text('Pagos sin confirmar')),
      body: FutureBuilder<List<dynamic>>(
        future: _futuro,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) return Center(child: Text('${snap.error}'));

          final pagos = snap.data!;
          if (pagos.isEmpty) {
            return const Center(child: Text('No hay pagos pendientes'));
          }

          return RefreshIndicator(
            onRefresh: () async => _recargar(),
            child: ListView.builder(
              itemCount: pagos.length,
              itemBuilder: (_, i) {
                final p = Map<String, dynamic>.from(pagos[i]);
                return ListTile(
                  leading: const Icon(Icons.hourglass_bottom),
                  title: Text('\$${p['monto']} · ${p['metodo']}'),
                  subtitle: Text('Ref: ${p['referencia'] ?? '-'}'),
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
