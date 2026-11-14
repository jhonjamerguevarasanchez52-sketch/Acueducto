import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/factura.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../services/flujo_pago_factura.dart';
import '../widgets/core/core.dart';
import '../widgets/home/home.dart';
import 'estado_servicio_screen.dart';
import 'pagos_screen.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

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
    setState(() {
      _facturas = futuro;
    });
    await futuro.catchError((_) => <Factura>[]);
  }

  Future<void> _pagar(Factura factura) async {
    try {
      final resultado = await FlujoPagoFactura.pagarFactura(
        context,
        context.read<AuthProvider>().api,
        factura,
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
      AppSnackbar.error(context, 'No se pudo completar el pago. Intenta de nuevo.');
      _refrescar();
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
              padding: EdgeInsets.fromLTRB(
                20,
                6,
                20,
                104 + MediaQuery.paddingOf(context).bottom,
              ),
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
                    icon: LucideIcons.banknote,
                    label: 'Mis pagos',
                    destino: () => const PagosScreen(),
                  ),
                  HomeModuloTile(
                    icon: LucideIcons.droplet,
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
