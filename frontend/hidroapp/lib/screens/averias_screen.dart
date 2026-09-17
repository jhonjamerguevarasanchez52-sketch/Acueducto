import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/averia.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../widgets/averias/averia_card.dart';
import '../widgets/averias/formulario_reporte.dart';
import '../widgets/gota_scaffold.dart';
import '../widgets/mensaje_estado.dart';

/// Módulo "Averías": el usuario reporta una avería del servicio y hace
/// seguimiento del estado en que la deja el fontanero.
class AveriasScreen extends StatefulWidget {
  const AveriasScreen({super.key});

  @override
  State<AveriasScreen> createState() => _AveriasScreenState();
}

class _AveriasScreenState extends State<AveriasScreen> {
  late Future<List<Averia>> _futuro;

  @override
  void initState() {
    super.initState();
    _futuro = _cargar();
  }

  Future<List<Averia>> _cargar() async {
    final data =
        await context.read<AuthProvider>().api.get('/averias/mis-averias');
    return Averia.listaDesde(data);
  }

  Future<void> _refrescar() async {
    final futuro = _cargar();
    setState(() => _futuro = futuro);
    await futuro.catchError((_) => <Averia>[]);
  }

  Future<void> _abrirReporte() async {
    final creada = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const FormularioReporteAveria(),
    );
    if (creada == true && mounted) {
      _refrescar();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Avería reportada. Gracias por avisar.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return GotaScaffold(
      appBar: AppBar(title: const Text('Averías')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _abrirReporte,
        icon: const Icon(Icons.add),
        label: const Text('Reportar'),
      ),
      body: RefreshIndicator(
        onRefresh: _refrescar,
        child: FutureBuilder<List<Averia>>(
          future: _futuro,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }

            if (snap.hasError) {
              return ListView(
                children: [
                  MensajeEstado.error(
                    mensaje: snap.error is ApiException
                        ? (snap.error as ApiException).message
                        : 'Ocurrió un error inesperado.',
                    onReintentar: _refrescar,
                  ),
                ],
              );
            }

            final averias = snap.data ?? const <Averia>[];
            if (averias.isEmpty) {
              return ListView(
                children: const [
                  MensajeEstado(
                    icono: Icons.build_outlined,
                    titulo: 'Sin averías reportadas',
                    detalle:
                        'Usa el botón "Reportar" si tienes un problema con el servicio.',
                  ),
                ],
              );
            }

            return ListView.builder(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
              itemCount: averias.length,
              itemBuilder: (context, i) => AveriaCard(averia: averias[i]),
            );
          },
        ),
      ),
    );
  }
}
