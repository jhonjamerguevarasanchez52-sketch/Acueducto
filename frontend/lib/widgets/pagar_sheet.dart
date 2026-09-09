import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Hoja inferior para elegir cómo se paga una factura. Devuelve por
/// `Navigator.pop` el método elegido y una referencia opcional; quien la
/// invoca es el que registra el pago contra `POST /api/pagos`.
///
/// Se usa tanto desde "Mis facturas" (pagar una factura pendiente) como desde
/// "Mis pagos" (reintentar un pago pendiente o rechazado).
Future<({String metodo, String? referencia})?> mostrarPagarSheet(
  BuildContext context, {
  required String subtitulo,
}) {
  return showModalBottomSheet<({String metodo, String? referencia})>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => _PagarSheet(subtitulo: subtitulo),
  );
}

class _PagarSheet extends StatefulWidget {
  const _PagarSheet({required this.subtitulo});

  final String subtitulo;

  @override
  State<_PagarSheet> createState() => _PagarSheetState();
}

class _PagarSheetState extends State<_PagarSheet> {
  static const _metodos = <({
    String id,
    String nombre,
    IconData icono,
    bool pideReferencia,
  })>[
    (
      id: 'efectivo',
      nombre: 'Efectivo',
      icono: Icons.payments_outlined,
      pideReferencia: false,
    ),
    (
      id: 'transferencia',
      nombre: 'Transferencia bancaria',
      icono: Icons.account_balance_outlined,
      pideReferencia: true,
    ),
    (
      id: 'nequi',
      nombre: 'Nequi',
      icono: Icons.smartphone_outlined,
      pideReferencia: true,
    ),
    (
      id: 'pse',
      nombre: 'PSE',
      icono: Icons.account_balance_wallet_outlined,
      pideReferencia: true,
    ),
  ];

  String _metodo = _metodos.first.id;
  final _referenciaCtrl = TextEditingController();

  @override
  void dispose() {
    _referenciaCtrl.dispose();
    super.dispose();
  }

  bool get _pideReferencia =>
      _metodos.firstWhere((m) => m.id == _metodo).pideReferencia;

  void _confirmar() {
    final ref = _referenciaCtrl.text.trim();
    Navigator.of(context).pop((
      metodo: _metodo,
      referencia: ref.isEmpty ? null : ref,
    ));
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 4,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Registrar pago',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 2),
          Text(
            widget.subtitulo,
            style: const TextStyle(color: AppTheme.secondaryText),
          ),
          const SizedBox(height: 14),
          for (final m in _metodos)
            _MetodoTile(
              nombre: m.nombre,
              icono: m.icono,
              seleccionado: m.id == _metodo,
              onTap: () => setState(() => _metodo = m.id),
            ),
          if (_pideReferencia) ...[
            const SizedBox(height: 12),
            TextField(
              controller: _referenciaCtrl,
              textInputAction: TextInputAction.done,
              onSubmitted: (_) => _confirmar(),
              decoration: const InputDecoration(
                labelText: 'Referencia o comprobante (opcional)',
              ),
            ),
          ],
          const SizedBox(height: 14),
          const Text(
            'El pago quedará pendiente hasta que el acueducto lo confirme.',
            style: TextStyle(fontSize: 12, color: AppTheme.secondaryText),
          ),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: _confirmar,
            child: const Text('Confirmar pago'),
          ),
        ],
      ),
    );
  }
}

class _MetodoTile extends StatelessWidget {
  const _MetodoTile({
    required this.nombre,
    required this.icono,
    required this.seleccionado,
    required this.onTap,
  });

  final String nombre;
  final IconData icono;
  final bool seleccionado;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: seleccionado ? AppTheme.surfaceTint : Colors.white,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: seleccionado ? AppTheme.primary : const Color(0xFFE3EEF4),
                width: seleccionado ? 1.4 : 1,
              ),
            ),
            child: Row(
              children: [
                Icon(icono, size: 20, color: AppTheme.primaryDark),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    nombre,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                Icon(
                  seleccionado
                      ? Icons.radio_button_checked
                      : Icons.radio_button_off,
                  size: 20,
                  color: seleccionado
                      ? AppTheme.primary
                      : AppTheme.secondaryText,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
