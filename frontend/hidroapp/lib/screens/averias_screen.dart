import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/averia.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../widgets/averias/averias.dart';
import '../widgets/core/core.dart';

/// Módulo "Averías": el usuario reporta una avería del servicio y hace
/// seguimiento del estado en que la deja el fontanero.
class AveriasScreen extends StatefulWidget {
  const AveriasScreen({super.key});

  @override
  State<AveriasScreen> createState() => _AveriasScreenState();
}

class _AveriasScreenState extends State<AveriasScreen> {
  late Future<List<Averia>> _futuro;
  late bool _esFontanero;

  // Ids de averías con un cambio de estado en curso. Vive aquí (no dentro de
  // AveriaCard) para no depender de que Flutter reutilice el State de la
  // tarjeta tras refrescar la lista: si viviera en la tarjeta, al llegar los
  // datos nuevos la bandera podía quedar "pegada" en true y el botón se veía
  // deshabilitado para siempre aunque el cambio ya se hubiera guardado.
  final Set<String> _actualizandoIds = {};

  @override
  void initState() {
    super.initState();
    final rol = context.read<AuthProvider>().profile?.rol;
    _esFontanero = rol == 'fontanero' || rol == 'administrador';
    _futuro = _cargar();
  }

  Future<List<Averia>> _cargar() async {
    final ruta = _esFontanero ? '/averias' : '/averias/mis-averias';
    final data = await context.read<AuthProvider>().api.get(ruta);
    return Averia.listaDesde(data);
  }

  Future<void> _refrescar() async {
    final futuro = _cargar();
    setState(() => _futuro = futuro);
    await futuro.catchError((_) => <Averia>[]);
  }

  Future<void> _cambiarEstado(Averia averia, String nuevoEstado) async {
    setState(() => _actualizandoIds.add(averia.id));
    try {
      await context.read<AuthProvider>().api.put(
        '/averias/${averia.id}',
        body: {'estado': nuevoEstado},
      );
      await _refrescar();
    } on ApiException catch (e) {
      if (mounted) AppSnackbar.error(context, e.message);
    } finally {
      if (mounted) setState(() => _actualizandoIds.remove(averia.id));
    }
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
      AppSnackbar.success(context, 'Avería reportada. Gracias por avisar.');
    }
  }

  @override
  Widget build(BuildContext context) {
    return GotaScaffold(
      appBar: HidroAppBar(
        title: _esFontanero ? 'Averías reportadas' : 'Averías',
      ),
      floatingActionButton: _esFontanero
          ? null
          : FloatingActionButton.extended(
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
              return const SkeletonLista();
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
                children: [
                  MensajeEstado(
                    icono: Icons.build_outlined,
                    titulo: 'Sin averías reportadas',
                    detalle: _esFontanero
                        ? 'Por ahora no hay averías pendientes.'
                        : 'Usa el botón "Reportar" si tienes un problema con el servicio.',
                  ),
                ],
              );
            }

            return ListView.builder(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
              itemCount: averias.length,
              itemBuilder: (context, i) {
                final averia = averias[i];
                return EntradaAnimada(
                  key: ValueKey(averia.id),
                  retraso: AppTheme.motionEscalon * i,
                  child: AveriaCard(
                    averia: averia,
                    actualizando: _actualizandoIds.contains(averia.id),
                    onCambiarEstado: _esFontanero
                        ? (nuevoEstado) => _cambiarEstado(averia, nuevoEstado)
                        : null,
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}
