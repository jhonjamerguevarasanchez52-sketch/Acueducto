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
    return GotaScaffold(
      appBar: HidroAppBar(
        title: 'Notificaciones',
        actions: [
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
