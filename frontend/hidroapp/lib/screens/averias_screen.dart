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
  late bool _esAdministrador;
  late bool _puedeVerTodasLasAverias;
  String _filtroEstado = 'todas';

  static const _filtrosEstado = <(String, String)>[
    ('todas', 'Todas'),
    ('reportada', 'Reportadas'),
    ('en_proceso', 'En proceso'),
    ('resuelta', 'Resueltas'),
    ('cancelada', 'Canceladas'),
  ];

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
    _esFontanero = rol == 'fontanero';
    _esAdministrador = rol == 'administrador';
    _puedeVerTodasLasAverias = _esFontanero || rol == 'administrador';
    _futuro = _cargar();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final rol = Provider.of<AuthProvider>(context).profile?.rol;
    final esFontanero = rol == 'fontanero';
    final esAdministrador = rol == 'administrador';
    final puedeVerTodasLasAverias = esFontanero || rol == 'administrador';
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

  /// Una petición puede perder la respuesta después de que el backend ya
  /// guardó el cambio. En ese caso consultamos el estado persistido antes de
  /// decirle al fontanero que la operación falló.
  Future<bool> _estadoYaGuardado(String averiaId, String estado) async {
    try {
      final averias = await _cargar();
      return averias.any((a) => a.id == averiaId && a.estado == estado);
    } catch (_) {
      return false;
    }
  }

  Future<void> _refrescar() async {
    final futuro = _cargar();
    setState(() => _futuro = futuro);
    await futuro.catchError((_) => <Averia>[]);
  }

  Future<void> _cambiarEstado(Averia averia, String nuevoEstado) async {
    final api = context.read<AuthProvider>().api;
    String? nota;
    if (nuevoEstado == 'resuelta' || nuevoEstado == 'en_proceso') {
      nota = await showDialog<String>(
        context: context,
        builder: (_) => _MensajeFontaneroDialog(estado: nuevoEstado),
      );

      if (!mounted || nota == null) return;
    }
    if (!mounted) return;
    setState(() => _actualizandoIds.add(averia.id));
    try {
      final body = <String, dynamic>{'estado': nuevoEstado};
      if (nota != null) body['nota'] = nota;
      final respuesta = await api.put('/averias/${averia.id}', body: body);

      await _refrescar();
      if (mounted) {
        final usuarioNotificado =
            respuesta is Map && respuesta['notificacionEnviada'] == true;
        final accion = nuevoEstado == 'resuelta'
            ? 'Avería solucionada'
            : 'Avería aceptada';
        if (usuarioNotificado) {
          AppSnackbar.success(context, '$accion. Se notificó al usuario.');
        } else {
          AppSnackbar.info(
            context,
            '$accion y quedó guardada. No se pudo confirmar el aviso al usuario.',
          );
        }
      }
    } on ApiException catch (e) {
      final guardada = await _estadoYaGuardado(averia.id, nuevoEstado);
      if (!mounted) return;
      if (guardada) {
        await _refrescar();
        if (mounted) {
          AppSnackbar.info(
            context,
            nuevoEstado == 'resuelta'
                ? 'La avería quedó solucionada y guardada. No se pudo confirmar el aviso al usuario.'
                : 'El cambio quedó guardado. No se pudo confirmar el aviso al usuario.',
          );
        }
      } else {
        AppSnackbar.error(context, e.message);
      }
    } catch (_) {
      final guardada = await _estadoYaGuardado(averia.id, nuevoEstado);
      if (!mounted) return;
      if (guardada) {
        await _refrescar();
        if (mounted) {
          AppSnackbar.info(
            context,
            nuevoEstado == 'resuelta'
                ? 'La avería quedó solucionada y guardada. No se pudo confirmar el aviso al usuario.'
                : 'El cambio quedó guardado. No se pudo confirmar el aviso al usuario.',
          );
        }
      } else {
        AppSnackbar.error(
          context,
          'No se pudo actualizar la avería. Intenta de nuevo.',
        );
      }
    } finally {
      if (mounted) setState(() => _actualizandoIds.remove(averia.id));
    }
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
                        ? 'Por ahora no hay averías pendientes.'
                        : 'Usa el botón "Reportar" si tienes un problema con el servicio.',
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
                final hayOtraEnProceso = todasLasAverias.any(
                  (otra) => otra.estado == 'en_proceso' && otra.id != averia.id,
                );
                return EntradaAnimada(
                  key: ValueKey(averia.id),
                  retraso: AppTheme.motionEscalon * (i - 1),
                  child: AveriaCard(
                    averia: averia,
                    actualizando: _actualizandoIds.contains(averia.id),
                    bloqueadaPorOtra: _esFontanero && hayOtraEnProceso,
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

/// El diálogo conserva su controlador durante la animación de cierre y lo
/// libera cuando la ruta ya desmontó el campo de texto.
class _MensajeFontaneroDialog extends StatefulWidget {
  const _MensajeFontaneroDialog({required this.estado});

  final String estado;

  @override
  State<_MensajeFontaneroDialog> createState() =>
      _MensajeFontaneroDialogState();
}

class _MensajeFontaneroDialogState extends State<_MensajeFontaneroDialog> {
  final _controlador = TextEditingController();

  @override
  void dispose() {
    _controlador.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final resuelta = widget.estado == 'resuelta';
    return AlertDialog(
      title: Text(resuelta ? 'Confirmar solución' : 'Aceptar avería'),
      content: TextField(
        controller: _controlador,
        maxLength: 1000,
        maxLines: 3,
        decoration: InputDecoration(
          labelText: 'Mensaje para el usuario (opcional)',
          hintText: resuelta
              ? 'Explica brevemente qué se solucionó'
              : 'Escribe una actualización para el usuario',
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(context, _controlador.text.trim()),
          child: Text(resuelta ? 'Marcar solucionada' : 'Aceptar avería'),
        ),
      ],
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