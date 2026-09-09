import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/factura.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../utils/formato.dart';
import '../widgets/mensaje_estado.dart';
import '../widgets/pagar_sheet.dart';
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

class _FacturasScreenState extends State<FacturasScreen> {
  late Future<List<Factura>> _futuro;

  @override
  void initState() {
    super.initState();
    _futuro = _cargar();
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
      subtitulo: '${Formato.periodo(factura.periodo)} · '
          '${Formato.pesos(factura.valorTotal)}',
    );
    if (eleccion == null || !mounted) return;

    try {
      await context.read<AuthProvider>().api.post('/pagos', body: {
        'factura_id': factura.id,
        'metodo': eleccion.metodo,
        if (eleccion.referencia != null) 'referencia': eleccion.referencia,
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Pago registrado. Queda pendiente de confirmación.'),
        ),
      );
      _refrescar();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message)),
      );
    }
  }

  void _verPagos() {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const PagosScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Mis facturas')),
      body: RefreshIndicator(
        onRefresh: _refrescar,
        child: FutureBuilder<List<Factura>>(
          future: _futuro,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
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
            final totalPendiente =
                pendientes.fold<double>(0, (s, f) => s + f.valorTotal);

            return ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: facturas.length + 1,
              itemBuilder: (context, i) {
                if (i == 0) {
                  return _Resumen(
                    cantidadPendiente: pendientes.length,
                    totalPendiente: totalPendiente,
                  );
                }
                final factura = facturas[i - 1];
                return _FacturaCard(
                  factura: factura,
                  onPagar: () => _pagar(factura),
                  onVerPagos: _verPagos,
                );
              },
            );
          },
        ),
      ),
    );
  }
}

class _Resumen extends StatelessWidget {
  const _Resumen({
    required this.cantidadPendiente,
    required this.totalPendiente,
  });

  final int cantidadPendiente;
  final double totalPendiente;

  @override
  Widget build(BuildContext context) {
    final alDia = cantidadPendiente == 0;
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppTheme.midBlue, AppTheme.deepBlue],
        ),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            alDia ? 'Estás al día' : 'Saldo pendiente',
            style: const TextStyle(
              color: Colors.white70,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            alDia ? '\$ 0' : Formato.pesos(totalPendiente),
            style: const TextStyle(
              color: Colors.white,
              fontSize: 26,
              fontWeight: FontWeight.w800,
            ),
          ),
          if (!alDia) ...[
            const SizedBox(height: 4),
            Text(
              cantidadPendiente == 1
                  ? '1 factura por pagar'
                  : '$cantidadPendiente facturas por pagar',
              style: const TextStyle(color: Colors.white70, fontSize: 13),
            ),
          ],
        ],
      ),
    );
  }
}

class _FacturaCard extends StatelessWidget {
  const _FacturaCard({
    required this.factura,
    required this.onPagar,
    required this.onVerPagos,
  });

  final Factura factura;
  final VoidCallback onPagar;
  final VoidCallback onVerPagos;

  ({String texto, Color color}) get _estado {
    switch (factura.estado) {
      case 'pagada':
        return (texto: 'Pagada', color: AppTheme.success);
      case 'anulada':
        return (texto: 'Anulada', color: AppTheme.secondaryText);
      case 'vencida':
        return (texto: 'Vencida', color: AppTheme.danger);
      default:
        return factura.estaVencida
            ? (texto: 'Vencida', color: AppTheme.danger)
            : (texto: 'Pendiente', color: AppTheme.warning);
    }
  }

  @override
  Widget build(BuildContext context) {
    final estado = _estado;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    Formato.periodo(factura.periodo),
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                EtiquetaEstado(texto: estado.texto, color: estado.color),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              Formato.pesos(factura.valorTotal),
              style: const TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: AppTheme.primaryDark,
              ),
            ),
            const SizedBox(height: 8),
            _fila(Icons.event_available_outlined,
                'Emitida: ${Formato.fecha(factura.fechaEmision)}'),
            if (factura.fechaVencimiento != null)
              _fila(Icons.schedule_outlined,
                  'Vence: ${Formato.fecha(factura.fechaVencimiento)}'),
            if (factura.observacion != null)
              _fila(Icons.sticky_note_2_outlined, factura.observacion!),
            if (factura.estaPendiente) ...[
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: onPagar,
                      icon: const Icon(Icons.payments_outlined, size: 18),
                      label: const Text('Pagar'),
                      style: FilledButton.styleFrom(
                        minimumSize: const Size.fromHeight(44),
                        textStyle: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: onVerPagos,
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size.fromHeight(44),
                        textStyle: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      child: const Text('Mis pagos'),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _fila(IconData icono, String texto) => Padding(
        padding: const EdgeInsets.only(top: 4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icono, size: 15, color: AppTheme.secondaryText),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                texto,
                style: const TextStyle(
                  fontSize: 13,
                  color: AppTheme.secondaryText,
                ),
              ),
            ),
          ],
        ),
      );
}
