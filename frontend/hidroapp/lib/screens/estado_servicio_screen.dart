import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/corte.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../utils/formato.dart';
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
                _TarjetaEstado(
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
                  ...datos.historial.map((c) => _CorteCard(corte: c)),
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

class _TarjetaEstado extends StatelessWidget {
  const _TarjetaEstado({required this.cortado, this.corteActivo});

  final bool cortado;
  final Corte? corteActivo;

  @override
  Widget build(BuildContext context) {
    final color = cortado ? AppTheme.danger : AppTheme.success;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: color.withValues(alpha: 0.30)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                cortado ? Icons.water_drop_outlined : Icons.water_drop,
                color: color,
                size: 28,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  cortado ? 'Servicio suspendido' : 'Servicio activo',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: color,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            cortado
                ? 'Tu suministro de agua está cortado en este momento.'
                : 'Tu suministro de agua funciona con normalidad.',
            style: const TextStyle(fontSize: 14, height: 1.35),
          ),
          if (cortado && corteActivo != null) ...[
            const SizedBox(height: 12),
            _fila(Icons.info_outline, 'Motivo: ${corteActivo!.motivo}'),
            _fila(Icons.event_busy_outlined,
                'Desde: ${Formato.fechaHora(corteActivo!.fechaCorte)}'),
          ],
        ],
      ),
    );
  }

  Widget _fila(IconData icono, String texto) => Padding(
        padding: const EdgeInsets.only(top: 4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icono, size: 15, color: AppTheme.secondaryText),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                texto,
                style: const TextStyle(
                  fontSize: 13,
                  color: AppTheme.secondaryText,
                ),
              ),
            ),
          ],
        ),
      );
}

class _CorteCard extends StatelessWidget {
  const _CorteCard({required this.corte});

  final Corte corte;

  @override
  Widget build(BuildContext context) {
    final activo = corte.activo;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    corte.motivo,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                EtiquetaEstado(
                  texto: activo ? 'Activo' : 'Resuelto',
                  color: activo ? AppTheme.danger : AppTheme.success,
                ),
              ],
            ),
            const SizedBox(height: 8),
            _fila(Icons.event_busy_outlined,
                'Corte: ${Formato.fechaHora(corte.fechaCorte)}'),
            if (corte.fechaReconexion != null)
              _fila(Icons.event_available_outlined,
                  'Reconexión: ${Formato.fechaHora(corte.fechaReconexion)}'),
          ],
        ),
      ),
    );
  }

  Widget _fila(IconData icono, String texto) => Padding(
        padding: const EdgeInsets.only(top: 4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icono, size: 15, color: AppTheme.secondaryText),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                texto,
                style: const TextStyle(
                  fontSize: 13,
                  color: AppTheme.secondaryText,
                ),
              ),
            ),
          ],
        ),
      );
}
