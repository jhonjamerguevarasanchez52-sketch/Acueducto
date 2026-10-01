import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/pago.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../utils/formato.dart';
import '../widgets/core/core.dart';
import '../widgets/pagos/pagos.dart';

/// Módulo "Mis pagos": historial de los pagos registrados por el usuario,
/// con su método y si ya fueron confirmados por el acueducto o Wompi.
class PagosScreen extends StatefulWidget {
  const PagosScreen({super.key});

  @override
  State<PagosScreen> createState() => _PagosScreenState();
}

class _PagosScreenState extends State<PagosScreen> {
  late Future<List<Pago>> _futuro;

  @override
  void initState() {
    super.initState();
    _futuro = _cargar();
  }

  Future<List<Pago>> _cargar() async {
    final data = await context.read<AuthProvider>().api.get('/pagos');
    return Pago.listaDesde(data);
  }

  Future<void> _refrescar() async {
    final futuro = _cargar();
    setState(() => _futuro = futuro);
    await futuro.catchError((_) => <Pago>[]);
  }

  /// Reintenta un pago que quedó pendiente o fue rechazado: registra uno nuevo
  /// contra la misma factura, que vuelve a quedar a la espera de confirmación.
  Future<void> _pagar(Pago pago) async {
    final eleccion = await mostrarPagarSheet(
      context,
      subtitulo: Formato.pesos(pago.monto),
    );
    if (eleccion == null || !mounted) return;

    try {
      await context.read<AuthProvider>().api.post('/pagos', body: {
        'factura_id': pago.facturaId,
        'metodo': eleccion.metodo,
        if (eleccion.referencia != null) 'referencia': eleccion.referencia,
      });
      if (!mounted) return;
      AppSnackbar.success(context, 'Pago registrado. Queda pendiente de confirmación.');
      _refrescar();
    } on ApiException catch (e) {
      if (!mounted) return;
      AppSnackbar.error(context, e.message);
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
                    icono: Icons.payments_outlined,
                    titulo: 'Sin pagos',
                    detalle: 'Aquí verás los pagos que registres.',
                  ),
                ],
              );
            }

            return ListView.builder(
              padding: const EdgeInsets.all(16),
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
