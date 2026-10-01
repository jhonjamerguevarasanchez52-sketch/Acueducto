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

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final rol = Provider.of<AuthProvider>(context).profile?.rol;
    final esFontanero = rol == 'fontanero' || rol == 'administrador';
    if (esFontanero != _esFontanero) {
      _esFontanero = esFontanero;
      _futuro = _cargar();
    }
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
    String? nota;
    if (nuevoEstado == 'resuelta') {
      final controlador = TextEditingController();
      nota = await showDialog<String>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Confirmar solución'),
          content: TextField(
            controller: controlador,
            maxLength: 1000,
            maxLines: 3,
            decoration: const InputDecoration(
              labelText: 'Mensaje para el usuario (opcional)',
              hintText: 'Explica brevemente qué se solucionó',
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, controlador.text.trim()),
              child: const Text('Marcar solucionada'),
            ),
          ],
        ),
      );
      controlador.dispose();
      if (nota == null) return;
    }
    setState(() => _actualizandoIds.add(averia.id));
    try {
      final respuesta = await context.read<AuthProvider>().api.put(
        '/averias/${averia.id}',
        body: {'estado': nuevoEstado, if (nota != null) 'nota': nota},
      );
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
            '$accion, pero no se pudo enviar la notificación al usuario.',
          );
        }
      }
    } on ApiException catch (e) {
      if (mounted) AppSnackbar.error(context, e.message);
    } catch (_) {
      if (mounted) {
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
