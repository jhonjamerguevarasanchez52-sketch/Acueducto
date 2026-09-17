import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/corte.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../widgets/estado_servicio/corte_card.dart';
import '../widgets/estado_servicio/tarjeta_estado.dart';
import '../widgets/gota_scaffold.dart';
import '../widgets/mensaje_estado.dart';

/// Módulo "Estado del servicio": dice si el agua del usuario está activa o
/// suspendida ahora mismo y muestra el historial de cortes y reconexiones.
class EstadoServicioScreen extends StatefulWidget {
  const EstadoServicioScreen({super.key});

  @override
  State<EstadoServicioScreen> createState() => _EstadoServicioScreenState();
}

class _EstadoServicioScreenState extends State<EstadoServicioScreen> {
  late Future<_DatosServicio> _futuro;

  @override
  void initState() {
    super.initState();
    _futuro = _cargar();
  }

  Future<_DatosServicio> _cargar() async {
    final api = context.read<AuthProvider>().api;
    final resultados = await Future.wait([
      api.get('/cortes/estado'),
      api.get('/cortes/mis-cortes'),
    ]);
    final estado = resultados[0] is Map
        ? EstadoServicio.fromJson(Map<String, dynamic>.from(resultados[0]))
        : EstadoServicio(servicioCortado: false);
    return _DatosServicio(
      estado: estado,
      historial: Corte.listaDesde(resultados[1]),
    );
  }

  Future<void> _refrescar() async {
    final futuro = _cargar();
    setState(() => _futuro = futuro);
    await futuro.catchError(
      (_) => _DatosServicio(
        estado: EstadoServicio(servicioCortado: false),
        historial: const [],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return GotaScaffold(
      appBar: AppBar(title: const Text('Estado del servicio')),
      body: RefreshIndicator(
        onRefresh: _refrescar,
        child: FutureBuilder<_DatosServicio>(
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

            final datos = snap.data!;
            final cortado = datos.estado.servicioCortado;

            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                TarjetaEstadoServicio(
                  cortado: cortado,
                  corteActivo: datos.estado.corte,
                ),
                const SizedBox(height: 20),
                if (datos.historial.isNotEmpty) ...[
                  const Padding(
                    padding: EdgeInsets.only(left: 4, bottom: 8),
                    child: Text(
                      'Historial',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  ...datos.historial.map((c) => CorteCard(corte: c)),
                ] else
                  const Padding(
                    padding: EdgeInsets.only(top: 24),
                    child: Text(
                      'No hay cortes registrados en tu historial.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: AppTheme.secondaryText),
                    ),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _DatosServicio {
  _DatosServicio({required this.estado, required this.historial});

  final EstadoServicio estado;
  final List<Corte> historial;
}
