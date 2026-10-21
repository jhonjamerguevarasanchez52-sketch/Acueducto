import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/factura.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../services/recibo_pago_service.dart';
import '../services/wompi_checkout_service.dart';
import '../utils/formato.dart';
import '../widgets/core/core.dart';
import '../widgets/home/home.dart';
import 'estado_servicio_screen.dart';
import 'pagos_screen.dart';

/// Pestaña "Inicio": da la bienvenida al usuario, muestra la factura pendiente
/// con su cuenta regresiva y botón de pago, y deja atajos a los módulos que no
/// están en la barra inferior. La navegación entre secciones vive en `MainShell`.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
  late Future<List<Factura>> _facturas;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _facturas = _cargarFacturas();
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

  Future<List<Factura>> _cargarFacturas() async {
    final data = await context.read<AuthProvider>().api.get('/facturas');
    return Factura.listaDesde(data);
  }

  Future<void> _refrescar() async {
    final futuro = _cargarFacturas();
    setState(() => _facturas = futuro);
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
        await WompiCheckoutService.pagar(
          context.read<AuthProvider>().api,
          factura.id,
        );
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

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final perfil = auth.profile;
    final textTheme = Theme.of(context).textTheme;

    return GotaScaffold(
      body: RefreshIndicator(
        onRefresh: _refrescar,
        child: ListView(
          padding: EdgeInsets.zero,
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            HomeCabecera(nombre: perfil?.nombre, zona: perfil?.zona),
            Transform.translate(
              offset: const Offset(0, -18),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: FutureBuilder<List<Factura>>(
                  future: _facturas,
                  builder: (context, snap) =>
                      ProximaFactura(snap: snap, onPagar: _pagar),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 6, 20, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const HomeMensajeDestacado(),
                  const SizedBox(height: 24),
                  Text(
                    'Más opciones',
                    style: textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 12),
                  HomeModuloTile(
                    icon: Icons.payments_outlined,
                    label: 'Mis pagos',
                    destino: () => const PagosScreen(),
                  ),
                  HomeModuloTile(
                    icon: Icons.water_drop_outlined,
                    label: 'Estado del servicio',
                    destino: () => const EstadoServicioScreen(),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
