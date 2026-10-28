import 'package:flutter/material.dart';

import '../../models/factura.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import '../../utils/formato.dart';
import '../core/pagar_sheet.dart';

/// Nombre comercial del plan según los meses que cubre.
String nombrePlanPago(int meses) => switch (meses) {
  1 => 'Mensual',
  6 => 'Semestral',
  12 => 'Anual',
  _ => '$meses meses',
};

/// Flujo completo de "Pagar": el usuario elige cuántos meses pagar (1, 6 o
/// 12), luego el medio de pago, y la factura queda configurada con ese plan
/// en el backend. Devuelve el medio elegido, o `null` si canceló.
Future<({String metodo, String? referencia})?> elegirPlanYMedioDePago(
  BuildContext context,
  ApiService api,
  Factura factura,
) async {
  final plan = await mostrarPlanPagoSheet(context, api, factura.id);
  if (plan == null || !context.mounted) return null;

  final meses = int.tryParse('${plan['meses']}') ?? 1;
  final servicio =
      num.tryParse('${plan['valorServicio']}') ?? factura.valorTotal;
  final inicio = Formato.periodo(plan['periodoInicio']?.toString());
  final fin = Formato.periodo(plan['periodoFin']?.toString());
  final periodo = meses > 1 ? '$inicio – $fin' : inicio;
  final eleccion = await mostrarPagarSheet(
    context,
    subtitulo:
        '${nombrePlanPago(meses)} · $periodo · ${Formato.pesos(servicio)}',
  );
  if (eleccion == null) return null;

  await api.post('/facturas/${factura.id}/plan-pago', body: {'meses': meses});
  return eleccion;
}

Future<Map<String, dynamic>?> mostrarPlanPagoSheet(
  BuildContext context,
  ApiService api,
  String facturaId,
) async {
  final respuesta = await api.get('/facturas/$facturaId/opciones-pago');
  if (respuesta is! Map || respuesta['opciones'] is! List) {
    throw ApiException('No se pudieron cargar los planes de pago.');
  }
  final opciones = (respuesta['opciones'] as List)
      .whereType<Map>()
      .map((opcion) => Map<String, dynamic>.from(opcion))
      .toList();
  if (opciones.isEmpty) {
    throw ApiException('Esta factura no tiene planes disponibles.');
  }

  if (!context.mounted) return null;
  return showModalBottomSheet<Map<String, dynamic>>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => _PlanPagoSheet(
      opciones: opciones,
      puedeCambiar: respuesta['puedeCambiarPlan'] == true,
      motivo: respuesta['motivoSinPlanes']?.toString(),
    ),
  );
}

/// Hoja de pago: arriba la factura tal como está (normalmente la mensualidad)
/// con su botón Pagar; al lado, "Más pagos" despliega el semestral y el anual.
class _PlanPagoSheet extends StatefulWidget {
  const _PlanPagoSheet({
    required this.opciones,
    required this.puedeCambiar,
    this.motivo,
  });

  final List<Map<String, dynamic>> opciones;
  final bool puedeCambiar;
  final String? motivo;

  @override
  State<_PlanPagoSheet> createState() => _PlanPagoSheetState();
}

class _PlanPagoSheetState extends State<_PlanPagoSheet> {
  bool _verMas = false;

  int _meses(Map<String, dynamic> o) => int.tryParse('${o['meses']}') ?? 1;
  num _num(Object? v) => num.tryParse('$v') ?? 0;

  /// La opción principal es la mensual; si la factura ya quedó con otro plan
  /// (y no se puede cambiar), es esa.
  Map<String, dynamic> get _principal => widget.opciones.firstWhere(
    (o) => _meses(o) == 1,
    orElse: () => widget.opciones.first,
  );

  List<Map<String, dynamic>> get _otras =>
      widget.opciones.where((o) => !identical(o, _principal)).toList();

  void _elegir(Map<String, dynamic> opcion) => Navigator.of(context).pop(opcion);

  /// Un plan bloqueado explica por qué y ofrece pagar solo la mensualidad.
  Future<void> _explicarBloqueo(Map<String, dynamic> opcion) async {
    final meses = _meses(opcion);
    final pagarMensual = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        icon: const Icon(Icons.lock_outline),
        title: Text('El plan ${nombrePlanPago(meses).toLowerCase()} no está disponible'),
        content: Text(
          opcion['motivoNoDisponible']?.toString() ??
              'Este plan incluye meses que ya tienen su propia factura.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Entendido'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Pagar solo esta mensualidad'),
          ),
        ],
      ),
    );
    if (pagarMensual == true && mounted) _elegir(_principal);
  }

  @override
  Widget build(BuildContext context) {
    final colores = AppColors.of(context);
    final principal = _principal;
    final otras = _otras;
    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Pagar factura',
              style: TextStyle(fontSize: 19, fontWeight: FontWeight.w800),
            ),
            if (widget.motivo != null) ...[
              const SizedBox(height: 5),
              Text(widget.motivo!, style: TextStyle(color: colores.secondaryText)),
            ],
            const SizedBox(height: 12),
            _tarjetaPrincipal(principal, colores, hayMas: otras.isNotEmpty),
            if (_verMas) ...[
              const SizedBox(height: 14),
              Text(
                'Paga varios meses y olvídate de la factura mensual',
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  color: colores.secondaryText,
                ),
              ),
              const SizedBox(height: 8),
              for (final opcion in otras) _opcionLarga(opcion, colores),
            ],
            const SizedBox(height: 10),
            Text(
              'Con Wompi se suma la comisión de la pasarela para que al '
              'acueducto le llegue completo el valor del servicio. '
              'En pago físico pagas solo el valor del servicio.',
              style: TextStyle(color: colores.secondaryText, fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }

  Widget _tarjetaPrincipal(
    Map<String, dynamic> opcion,
    AppColors colores, {
    required bool hayMas,
  }) {
    final meses = _meses(opcion);
    final inicio = '${opcion['periodoInicio'] ?? ''}';
    final fin = '${opcion['periodoFin'] ?? ''}';
    final servicio = _num(opcion['valorServicio']);
    final total = _num(opcion['totalCobrar']);
    final proxima = DateTime.tryParse('${opcion['fechaProximaFacturacion'] ?? ''}');
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              meses > 1
                  ? '${nombrePlanPago(meses)}: ${Formato.periodo(inicio)} – ${Formato.periodo(fin)}'
                  : 'Mensualidad de ${Formato.periodo(inicio)}',
              style: TextStyle(color: colores.secondaryText, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 4),
            Text(
              Formato.pesos(servicio),
              style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800),
            ),
            Text(
              'Con Wompi: ${Formato.pesos(total)} (comisión ${Formato.pesos(_num(opcion['cargoWompi']))})',
              style: TextStyle(color: colores.info, fontWeight: FontWeight.w600),
            ),
            if (opcion['proximoPeriodo'] != null && proxima != null) ...[
              const SizedBox(height: 4),
              Text(
                'Próxima factura: ${Formato.periodo('${opcion['proximoPeriodo']}')} · '
                'se genera el ${Formato.fecha(proxima)}',
                style: TextStyle(color: colores.secondaryText, fontSize: 12.5),
              ),
            ],
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: FilledButton.icon(
                    onPressed: () => _elegir(opcion),
                    icon: const Icon(Icons.payments_outlined, size: 18),
                    label: const Text('Pagar'),
                  ),
                ),
                if (hayMas) ...[
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => setState(() {
                        _verMas = !_verMas;
                      }),
                      icon: Icon(_verMas ? Icons.expand_less : Icons.expand_more, size: 18),
                      label: const Text('Más pagos'),
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _opcionLarga(Map<String, dynamic> opcion, AppColors colores) {
    final meses = _meses(opcion);
    final inicio = '${opcion['periodoInicio'] ?? ''}';
    final fin = '${opcion['periodoFin'] ?? ''}';
    final proxima = DateTime.tryParse('${opcion['fechaProximaFacturacion'] ?? ''}');
    final servicio = _num(opcion['valorServicio']);
    final total = _num(opcion['totalCobrar']);
    // Respuestas antiguas del backend no traen el campo: se asume disponible.
    final disponible = opcion['disponible'] != false;
    final motivo = opcion['motivoNoDisponible']?.toString();

    return Opacity(
      opacity: disponible ? 1 : 0.5,
      child: Card(
        margin: const EdgeInsets.only(bottom: 8),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => disponible ? _elegir(opcion) : _explicarBloqueo(opcion),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        '${nombrePlanPago(meses)} · ${Formato.pesos(servicio)}',
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
                      ),
                    ),
                    Icon(disponible ? Icons.chevron_right : Icons.lock_outline),
                  ],
                ),
                const SizedBox(height: 4),
                Text('$meses mensualidades: ${Formato.periodo(inicio)} – ${Formato.periodo(fin)}'),
                if (opcion['proximoPeriodo'] != null && proxima != null)
                  Text(
                    'Próxima factura: ${Formato.periodo('${opcion['proximoPeriodo']}')} · '
                    'se genera el ${Formato.fecha(proxima)}',
                  ),
                const SizedBox(height: 6),
                Text(
                  'Total con Wompi: ${Formato.pesos(total)}',
                  style: TextStyle(color: colores.info, fontWeight: FontWeight.w700),
                ),
                if (!disponible && motivo != null) ...[
                  const SizedBox(height: 4),
                  Text(motivo, style: TextStyle(color: colores.secondaryText, fontSize: 12)),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
