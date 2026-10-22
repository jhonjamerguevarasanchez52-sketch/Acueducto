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
  bool _esFontanero = false;
  bool _esAdministrador = false;
  bool _puedeVerTodasLasAverias = false;
  String _filtroEstado = 'todas';

  static const _filtrosEstado = <(String, String)>[
    ('todas', 'Todas'),
    ('reportada', 'Reportadas'),
    ('en_proceso', 'En proceso'),
    ('resuelta', 'Resueltas'),
    ('cancelada', 'Canceladas'),
  ];

  @override
  void initState() {
    super.initState();
    final rol = context.read<AuthProvider>().profile?.rol.trim().toLowerCase();
    _esFontanero = rol == 'fontanero';
    _esAdministrador = rol == 'administrador';
    _puedeVerTodasLasAverias = _esFontanero || _esAdministrador;
    _futuro = _cargar();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final rol = Provider.of<AuthProvider>(context).profile?.rol.trim().toLowerCase();
    final esFontanero = rol == 'fontanero';
    final esAdministrador = rol == 'administrador';
    final puedeVerTodasLasAverias = esFontanero || esAdministrador;
    if (esFontanero != _esFontanero ||
        esAdministrador != _esAdministrador ||
        puedeVerTodasLasAverias != _puedeVerTodasLasAverias) {
      final cambioAlcance = puedeVerTodasLasAverias != _puedeVerTodasLasAverias;
      _esFontanero = esFontanero;
      _esAdministrador = esAdministrador;
      _puedeVerTodasLasAverias = puedeVerTodasLasAverias;
      if (cambioAlcance) {
        _futuro = _cargar();
      }
    }
  }

  Future<List<Averia>> _cargar() async {
    final ruta = _puedeVerTodasLasAverias ? '/averias' : '/averias/mis-averias';
    final data = await context.read<AuthProvider>().api.get(ruta);
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
      isDismissible: false,
      enableDrag: false,
      builder: (_) => FormularioReporteAveria(
        esAdministrador: _esAdministrador,
        onCerrar: () => Navigator.of(context).pop(false),
      ),
    );
    if (creada == true && mounted) {
      await _refrescar();
      if (mounted) {
        await showDialog<void>(
          context: context,
          barrierDismissible: false,
          builder: (_) => const _AveriaReportadaDialog(),
        );
      }
    }
  }

  Widget _barraFiltros(List<Averia> averias) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            for (final (estado, etiqueta) in _filtrosEstado) ...[
              if (estado != _filtrosEstado.first.$1) const SizedBox(width: 8),
              ChoiceChip(
                label: Text(
                  '$etiqueta (${estado == 'todas' ? averias.length : averias.where((a) => a.estado == estado).length})',
                ),
                selected: _filtroEstado == estado,
                onSelected: (_) => setState(() => _filtroEstado = estado),
              ),
            ],
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final rol = context.watch<AuthProvider>().profile?.rol.trim().toLowerCase();
    final puedeReportar = rol == 'usuario' || rol == 'administrador';

    return GotaScaffold(
      appBar: HidroAppBar(
        title: _puedeVerTodasLasAverias ? 'Averías reportadas' : 'Averías',
        actions: [
          IconButton(
            tooltip: 'Actualizar averías',
            onPressed: () => _refrescar(),
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      floatingActionButton: puedeReportar
          ? FloatingActionButton.extended(
              onPressed: _abrirReporte,
              icon: const Icon(Icons.add),
              label: const Text('Reportar'),
            )
          : null,
      body: RefreshIndicator(
        onRefresh: _refrescar,
        child: FutureBuilder<List<Averia>>(
          future: _futuro,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting &&
                !snap.hasData) {
              return const SkeletonLista();
            }

            if (snap.hasError && !snap.hasData) {
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

            final todasLasAverias = snap.data ?? const <Averia>[];
            if (todasLasAverias.isEmpty) {
              return ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
                children: [
                  _barraFiltros(todasLasAverias),
                  MensajeEstado(
                    icono: Icons.build_outlined,
                    titulo: 'Sin averías reportadas',
                    detalle: _esFontanero
                        ? 'No hay averías para mostrar.'
                        : 'Usa el botón Reportar si tienes un problema con el servicio.',
                  ),
                ],
              );
            }

            final averias = _filtroEstado == 'todas'
                ? todasLasAverias
                : todasLasAverias
                      .where((averia) => averia.estado == _filtroEstado)
                      .toList();

            return ListView.builder(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
              itemCount: averias.isEmpty ? 2 : averias.length + 1,
              itemBuilder: (context, i) {
                if (i == 0) {
                  return _barraFiltros(todasLasAverias);
                }

                if (averias.isEmpty) {
                  return Padding(
                    padding: const EdgeInsets.only(top: 48),
                    child: MensajeEstado(
                      icono: Icons.filter_list_off,
                      titulo:
                          'No hay averías ${_filtrosEstado.firstWhere((f) => f.$1 == _filtroEstado).$2.toLowerCase()}',
                      detalle: 'Prueba otro filtro para ver más averías.',
                    ),
                  );
                }

                final averia = averias[i - 1];
                return EntradaAnimada(
                  key: ValueKey(averia.id),
                  retraso: AppTheme.motionEscalon * (i - 1),
                  child: AveriaCard(
                    averia: averia,
                    mostrarDetallesOperativos: _esAdministrador,
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


class _AveriaReportadaDialog extends StatefulWidget {
  const _AveriaReportadaDialog();

  @override
  State<_AveriaReportadaDialog> createState() => _AveriaReportadaDialogState();
}

class _AveriaReportadaDialogState extends State<_AveriaReportadaDialog>
    with SingleTickerProviderStateMixin {
  late final AnimationController _animacion;
  late final Animation<double> _escala;

  @override
  void initState() {
    super.initState();
    _animacion = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 420),
    );
    _escala = CurvedAnimation(parent: _animacion, curve: Curves.elasticOut);
    _animacion.forward();
    Future<void>.delayed(const Duration(milliseconds: 1300), () {
      if (mounted) Navigator.of(context).pop();
    });
  }

  @override
  void dispose() {
    _animacion.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colores = AppColors.of(context);
    return AlertDialog(
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ScaleTransition(
            scale: _escala,
            child: CircleAvatar(
              radius: 34,
              backgroundColor: colores.success.withValues(alpha: 0.14),
              child: Icon(Icons.water_drop, size: 38, color: colores.success),
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            '¡Avería reportada!',
            style: TextStyle(fontSize: 19, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 6),
          Text(
            'El fontanero recibió el aviso.',
            textAlign: TextAlign.center,
            style: TextStyle(color: colores.secondaryText),
          ),
        ],
      ),
    );
  }
}
