import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/pago.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../utils/formato.dart';
import '../widgets/gota_scaffold.dart';
import '../widgets/mensaje_estado.dart';
import '../widgets/pagar_sheet.dart';

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

  @override
  Widget build(BuildContext context) {
    return GotaScaffold(
      appBar: AppBar(title: const Text('Mis pagos')),
      body: RefreshIndicator(
        onRefresh: _refrescar,
        child: FutureBuilder<List<Pago>>(
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
              itemBuilder: (context, i) => _PagoCard(
                pago: pagos[i],
                onPagar: () => _pagar(pagos[i]),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _PagoCard extends StatelessWidget {
  const _PagoCard({required this.pago, required this.onPagar});

  final Pago pago;

  /// Registra un nuevo intento de pago para esta factura. Solo tiene sentido
  /// mientras el pago no esté confirmado.
  final VoidCallback onPagar;

  static const _metodos = {
    'efectivo': 'Efectivo',
    'nequi': 'Nequi',
    'pse': 'PSE',
    'tarjeta': 'Tarjeta',
    'transferencia': 'Transferencia',
    'wompi': 'Wompi',
  };

  ({String texto, Color color, IconData icono}) get _estado {
    if (pago.confirmado) {
      return (
        texto: 'Confirmado',
        color: AppTheme.success,
        icono: Icons.check_circle,
      );
    }
    if (pago.rechazado) {
      return (
        texto: 'Rechazado',
        color: AppTheme.danger,
        icono: Icons.cancel,
      );
    }
    return (
      texto: 'Pendiente de confirmación',
      color: AppTheme.warning,
      icono: Icons.hourglass_bottom,
    );
  }

  @override
  Widget build(BuildContext context) {
    final estado = _estado;
    final metodo = _metodos[pago.metodo] ?? Formato.etiqueta(pago.metodo);

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
                    Formato.pesos(pago.monto),
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: AppTheme.primaryDark,
                    ),
                  ),
                ),
                Text(
                  metodo,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    color: AppTheme.secondaryText,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Icon(estado.icono, size: 16, color: estado.color),
                const SizedBox(width: 6),
                Text(
                  estado.texto,
                  style: TextStyle(
                    color: estado.color,
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            _fila(Icons.event_outlined,
                'Registrado: ${Formato.fechaHora(pago.fechaPago)}'),
            if (pago.confirmado && pago.fechaConfirmacion != null)
              _fila(Icons.verified_outlined,
                  'Confirmado: ${Formato.fechaHora(pago.fechaConfirmacion)}'),
            if (pago.referencia != null)
              _fila(Icons.tag, 'Referencia: ${pago.referencia}'),
            if (!pago.confirmado) ...[
              const SizedBox(height: 14),
              FilledButton.icon(
                onPressed: onPagar,
                icon: const Icon(Icons.payments_outlined, size: 18),
                label: Text(pago.rechazado ? 'Volver a pagar' : 'Pagar'),
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(44),
                  textStyle: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
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
