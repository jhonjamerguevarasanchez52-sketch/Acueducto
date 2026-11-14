import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/pago.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../services/flujo_pago_factura.dart';
import '../theme/app_theme.dart';
import '../widgets/core/core.dart';
import '../widgets/pagos/pagos.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

/// Módulo "Mis pagos": historial de los pagos registrados por el usuario,
/// con su método y si ya fueron confirmados por el acueducto o Wompi.
class PagosScreen extends StatefulWidget {
  const PagosScreen({super.key});

  @override
  State<PagosScreen> createState() => _PagosScreenState();
}

class _PagosScreenState extends State<PagosScreen> with WidgetsBindingObserver {
  late Future<List<Pago>> _futuro;

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

  Future<List<Pago>> _cargar() async {
    final data = await context.read<AuthProvider>().api.get('/pagos');
    return Pago.listaDesde(data);
  }

  Future<void> _refrescar() async {
    final futuro = _cargar();
    setState(() {
      _futuro = futuro;
    });
    await futuro.catchError((_) => <Pago>[]);
  }

  /// Reintenta un pago que quedó pendiente o fue rechazado: registra uno nuevo
  /// contra la misma factura, que vuelve a quedar a la espera de confirmación.
  Future<void> _pagar(Pago pago) async {
    try {
      final resultado = await FlujoPagoFactura.reintentarPago(
        context,
        context.read<AuthProvider>().api,
        pago,
      );
      final mensaje = FlujoPagoFactura.mensaje(resultado);
      if (mensaje == null || !mounted) return;
      AppSnackbar.success(context, mensaje);
      _refrescar();
    } on ApiException catch (e) {
      if (!mounted) return;
      AppSnackbar.error(context, e.message);
      // Si el pago falló a mitad de camino, mostrar el estado real.
      _refrescar();
    } catch (_) {
      if (!mounted) return;
      AppSnackbar.error(
        context,
        'No se pudo completar el pago. Intenta de nuevo.',
      );
      _refrescar();
    }
  }

  @override
  Widget build(BuildContext context) {
    return GotaScaffold(
      appBar: const HidroAppBar(title: 'Mis pagos'),
      body: RefreshIndicator(
        onRefresh: _refrescar,
        child: FutureBuilder<List<Pago>>(
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

            final pagos = snap.data ?? const <Pago>[];
            if (pagos.isEmpty) {
              return ListView(
                children: const [
                  MensajeEstado(
                    icono: LucideIcons.banknote,
                    titulo: 'Sin pagos',
                    detalle: 'Aquí verás los pagos que registres.',
                  ),
                ],
              );
            }

            return ListView.builder(
              // Espacio extra abajo: la barra de botones de Android y la gota
              // flotante no deben tapar el botón Pagar de la última tarjeta.
              padding: EdgeInsets.fromLTRB(
                16,
                16,
                16,
                104 + MediaQuery.paddingOf(context).bottom,
              ),
              itemCount: pagos.length,
              itemBuilder: (context, i) => EntradaAnimada(
                retraso: AppTheme.motionEscalon * i,
                child: PagoCard(
                  pago: pagos[i],
                  onPagar: () => _pagar(pagos[i]),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
