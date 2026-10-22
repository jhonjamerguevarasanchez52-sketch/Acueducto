import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/factura.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../services/recibo_pago_service.dart';
import '../services/wompi_checkout_service.dart';
import '../theme/app_theme.dart';
import '../utils/formato.dart';
import '../widgets/core/core.dart';
import '../widgets/facturas/facturas.dart';
import 'pagos_screen.dart';

/// Módulo "Mis facturas": lista las facturas del usuario, de la más reciente
/// a la más antigua, con su estado y su valor. Cada factura pendiente trae un
/// botón "Pagar" que registra el pago (queda pendiente de que el acueducto lo
/// confirme) y otro para ir al historial de pagos.
class FacturasScreen extends StatefulWidget {
  const FacturasScreen({super.key});

  @override
  State<FacturasScreen> createState() => _FacturasScreenState();
}

class _FacturasScreenState extends State<FacturasScreen>
    with WidgetsBindingObserver {
  late Future<List<Factura>> _futuro;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _futuro = _cargar();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && mounted) _refrescar();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  Future<List<Factura>> _cargar() async {
    final data = await context.read<AuthProvider>().api.get('/facturas');
    return Factura.listaDesde(data);
  }

  Future<void> _refrescar() async {
    final futuro = _cargar();
    setState(() => _futuro = futuro);
    await futuro.catchError((_) => <Factura>[]);
  }

  Future<void> _pagar(Factura factura) async {
    final eleccion = await mostrarPagarSheet(
      context,
      subtitulo:
          '${Formato.periodo(factura.periodo)} · '
          '${Formato.pesos(factura.valorTotal)}',
    );
    if (eleccion == null || !mounted) return;

    try {
      if (eleccion.metodo == 'wompi') {
        final abierto = await WompiCheckoutService.pagar(
          context,
          context.read<AuthProvider>().api,
          factura.id,
        );
        if (!abierto) return;
        if (!mounted) return;
        AppSnackbar.success(
          context,
          'Checkout abierto. El estado se actualizará al volver.',
        );
        _refrescar();
        return;
      }
      if (eleccion.metodo == 'fisico') {
        final subido = await ReciboPagoService.subir(
          context.read<AuthProvider>().api,
          factura.id,
        );
        if (!mounted) return;
        if (subido) {
          AppSnackbar.success(context, 'Recibo enviado. Pago pendiente de revisión.');
          _refrescar();
        }
        return;
      }
      await context.read<AuthProvider>().api.post(
        '/pagos',
        body: {
          'factura_id': factura.id,
          'metodo': eleccion.metodo,
          if (eleccion.referencia != null) 'referencia': eleccion.referencia,
        },
      );
      if (!mounted) return;
      AppSnackbar.success(
        context,
        'Pago registrado. Queda pendiente de confirmación.',
      );
      _refrescar();
    } on ApiException catch (e) {
      if (!mounted) return;
      AppSnackbar.error(context, e.message);
    }
  }

  void _verPagos() {
    Navigator.of(
      context,
    ).push(MaterialPageRoute(builder: (_) => const PagosScreen()));
  }

  @override
  Widget build(BuildContext context) {
    return GotaScaffold(
      appBar: const HidroAppBar(title: 'Mis facturas'),
      body: RefreshIndicator(
        onRefresh: _refrescar,
        child: FutureBuilder<List<Factura>>(
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

            final facturas = snap.data ?? const <Factura>[];
            if (facturas.isEmpty) {
              return ListView(
                children: const [
                  MensajeEstado(
                    icono: Icons.receipt_long_outlined,
                    titulo: 'Sin facturas',
                    detalle: 'Todavía no tienes facturas emitidas.',
                  ),
                ],
              );
            }

            final pendientes = facturas.where((f) => f.estaPendiente).toList();
            final totalPendiente = pendientes.fold<double>(
              0,
              (s, f) => s + f.valorTotal,
            );

            return ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: facturas.length + 1,
              itemBuilder: (context, i) {
                if (i == 0) {
                  return FacturasResumen(
                    cantidadPendiente: pendientes.length,
                    totalPendiente: totalPendiente,
                  );
                }
                final factura = facturas[i - 1];
                return EntradaAnimada(
                  retraso: AppTheme.motionEscalon * i,
                  child: FacturaCard(
                    factura: factura,
                    onPagar: () => _pagar(factura),
                    onVerPagos: _verPagos,
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
