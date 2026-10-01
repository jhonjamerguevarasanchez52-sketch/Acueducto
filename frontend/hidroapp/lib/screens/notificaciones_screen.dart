import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/notificacion.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../utils/formato.dart';
import '../widgets/core/core.dart';
import 'averias_screen.dart';
import 'estado_servicio_screen.dart';
import 'facturas_screen.dart';

/// Módulo "Notificaciones": avisos del acueducto (facturas, pagos, averías,
/// cortes, mensajes generales). Se pueden marcar como leídas una a una o
/// todas de golpe.
class NotificacionesScreen extends StatefulWidget {
  const NotificacionesScreen({super.key});

  @override
  State<NotificacionesScreen> createState() => _NotificacionesScreenState();
}

class _NotificacionesScreenState extends State<NotificacionesScreen> {
  late Future<List<Notificacion>> _futuro;
  List<Notificacion> _notificaciones = const [];
  bool _marcandoTodas = false;
  bool _enviandoAviso = false;

  Future<void> _publicarAviso() async {
    final mensajeCtrl = TextEditingController();
    var tipo = 'corte';
    final enviar = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Aviso para todos'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'corte', label: Text('Corte o daño')),
                  ButtonSegment(value: 'general', label: Text('General')),
                ],
                selected: {tipo},
                onSelectionChanged: (seleccion) =>
                    setDialogState(() => tipo = seleccion.first),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: mensajeCtrl,
                maxLength: 1000,
                maxLines: 4,
                decoration: const InputDecoration(
                  labelText: 'Mensaje',
                  hintText: 'Indica la zona afectada y la duración estimada',
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Enviar aviso'),
            ),
          ],
        ),
      ),
    );
    final mensaje = mensajeCtrl.text.trim();
    mensajeCtrl.dispose();
    if (enviar != true || mensaje.isEmpty) return;
    setState(() => _enviandoAviso = true);
    try {
      await context.read<AuthProvider>().api.post('/notificaciones', body: {
        'perfil_id': 'todos', 'mensaje': mensaje, 'tipo': tipo,
      });
      await _refrescar();
      if (mounted) AppSnackbar.success(context, 'Aviso enviado a todos los perfiles activos.');
    } on ApiException catch (e) {
      if (mounted) AppSnackbar.error(context, e.message);
    } finally {
      if (mounted) setState(() => _enviandoAviso = false);
    }
  }

  @override
  void initState() {
    super.initState();
    _futuro = _cargar();
  }

  Future<List<Notificacion>> _cargar() async {
    final data = await context.read<AuthProvider>().api.get('/notificaciones');
    final lista = Notificacion.listaDesde(data);
    _notificaciones = lista;
    return lista;
  }

  Future<void> _refrescar() async {
    final futuro = _cargar();
    setState(() => _futuro = futuro);
    await futuro.catchError((_) => <Notificacion>[]);
  }

  int get _noLeidas => _notificaciones.where((n) => !n.leida).length;

  Future<void> _marcarUna(Notificacion n) async {
    if (n.leida) return;
    setState(() {
      _notificaciones = [
        for (final x in _notificaciones)
          x.id == n.id ? x.copyWith(leida: true) : x,
      ];
    });
    try {
      await context
          .read<AuthProvider>()
          .api
          .put('/notificaciones/${n.id}/leida');
    } on ApiException {
      // Si falla, revertimos el cambio visual.
      if (!mounted) return;
      setState(() {
        _notificaciones = [
          for (final x in _notificaciones)
            x.id == n.id ? x.copyWith(leida: false) : x,
        ];
      });
    }
  }

  /// Según el tipo de aviso, abre la pantalla donde el usuario puede ver el
  /// detalle o actuar sobre lo que causó la notificación (pagar la factura,
  /// ver el estado de la avería, etc.).
  void _abrirCausante(Notificacion n) {
    _marcarUna(n);
    Widget? destino;
    switch (n.tipo) {
      case 'factura':
      case 'pago':
      case 'cuota_extraordinaria':
        destino = const FacturasScreen();
        break;
      case 'averia':
        destino = const AveriasScreen();
        break;
      case 'corte':
        destino = const EstadoServicioScreen();
        break;
    }
    if (destino != null) {
      Navigator.of(context)
          .push(MaterialPageRoute(builder: (_) => destino!));
    }
  }

  Future<void> _marcarTodas() async {
    if (_noLeidas == 0 || _marcandoTodas) return;
    setState(() => _marcandoTodas = true);
    final previas = _notificaciones;
    setState(() {
      _notificaciones = [
        for (final x in _notificaciones) x.copyWith(leida: true),
      ];
    });
    try {
      await context
          .read<AuthProvider>()
          .api
          .put('/notificaciones/marcar-todas');
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _notificaciones = previas);
      AppSnackbar.error(context, e.message);
    } finally {
      if (mounted) setState(() => _marcandoTodas = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final rol = context.watch<AuthProvider>().profile?.rol;
    final puedePublicar = rol == 'fontanero' || rol == 'administrador';
    return GotaScaffold(
      appBar: HidroAppBar(
        title: 'Notificaciones',
        actions: [
          if (puedePublicar)
            IconButton(
              tooltip: 'Avisar a todos',
              onPressed: _enviandoAviso ? null : _publicarAviso,
              icon: _enviandoAviso
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.campaign_outlined),
            ),
          if (_noLeidas > 0)
            TextButton(
              onPressed: _marcandoTodas ? null : _marcarTodas,
              style: TextButton.styleFrom(foregroundColor: Colors.white),
              child: const Text('Marcar todas'),
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _refrescar,
        child: FutureBuilder<List<Notificacion>>(
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

            if (_notificaciones.isEmpty) {
              return ListView(
                children: const [
                  MensajeEstado(
                    icono: Icons.notifications_none,
                    titulo: 'Sin notificaciones',
                    detalle: 'Aquí llegarán los avisos del acueducto.',
                  ),
                ],
              );
            }

            return ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: _notificaciones.length,
              separatorBuilder: (_, _) => const SizedBox(height: 8),
              itemBuilder: (context, i) => EntradaAnimada(
                retraso: AppTheme.motionEscalon * i,
                child: _NotificacionCard(
                  notificacion: _notificaciones[i],
                  onTap: () => _abrirCausante(_notificaciones[i]),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _NotificacionCard extends StatelessWidget {
  const _NotificacionCard({required this.notificacion, required this.onTap});

  final Notificacion notificacion;
  final VoidCallback onTap;

  static const _iconos = {
    'factura': Icons.receipt_long,
    'pago': Icons.payments_outlined,
    'averia': Icons.build_outlined,
    'corte': Icons.water_drop_outlined,
    'general': Icons.campaign_outlined,
  };

  @override
  Widget build(BuildContext context) {
    final leida = notificacion.leida;
    final icono = _iconos[notificacion.tipo] ?? Icons.notifications_none;
    final colores = AppColors.of(context);

    return Material(
      color: leida ? colores.cardBackground : colores.chipBackground,
      borderRadius: BorderRadius.circular(AppTheme.cardRadius),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppTheme.cardRadius),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppTheme.cardRadius),
            border: Border.all(
              color: leida ? colores.cardBorder : AppTheme.accent,
            ),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: leida ? colores.chipBackground : colores.cardBackground,
                  shape: BoxShape.circle,
                ),
                child: Icon(icono, size: 20, color: colores.info),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      notificacion.mensaje,
                      style: TextStyle(
                        fontSize: 14,
                        height: 1.35,
                        fontWeight:
                            leida ? FontWeight.w400 : FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      Formato.fechaHora(notificacion.fecha),
                      style: TextStyle(
                        fontSize: 12,
                        color: colores.secondaryText,
                      ),
                    ),
                  ],
                ),
              ),
              if (!leida)
                Container(
                  margin: const EdgeInsets.only(left: 8, top: 4),
                  width: 9,
                  height: 9,
                  decoration: const BoxDecoration(
                    color: AppTheme.primary,
                    shape: BoxShape.circle,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
