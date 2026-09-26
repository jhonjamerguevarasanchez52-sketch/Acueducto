import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import '../core/app_snackbar.dart';

/// Hoja inferior con el formulario para reportar una nueva avería. Devuelve
/// `true` por `Navigator.pop` cuando el reporte se crea con éxito.
class FormularioReporteAveria extends StatefulWidget {
  const FormularioReporteAveria({super.key});

  @override
  State<FormularioReporteAveria> createState() =>
      _FormularioReporteAveriaState();
}

class _FormularioReporteAveriaState extends State<FormularioReporteAveria> {
  final _formKey = GlobalKey<FormState>();
  final _descripcionCtrl = TextEditingController();
  bool _enviando = false;
  bool _ubicacionConfirmada = false;

  @override
  void dispose() {
    _descripcionCtrl.dispose();
    super.dispose();
  }

  Future<void> _enviar() async {
    if (!_formKey.currentState!.validate()) return;
    if (!_ubicacionConfirmada) {
      AppSnackbar.error(context, 'Confirma que esa es la ubicación de la avería');
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() => _enviando = true);
    try {
      await context.read<AuthProvider>().api.post(
        '/averias',
        body: {
          'descripcion': _descripcionCtrl.text.trim(),
          'ubicacionConfirmada': true,
        },
      );
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _enviando = false);
        AppSnackbar.error(context, e.message);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final fondo = MediaQuery.of(context).viewInsets.bottom;
    final perfil = context.watch<AuthProvider>().profile;
    final ubicacion = perfil?.ubicacionCuenta;
    final colores = AppColors.of(context);
    return Padding(
      padding: EdgeInsets.only(bottom: fondo),
      child: Container(
        decoration: BoxDecoration(
          color: colores.cardBackground,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        ),
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
        child: SafeArea(
          top: false,
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(
                      color: const Color(0xFFDCE7EF),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const Text(
                  'Reportar una avería',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 4),
                Text(
                  'Describe qué está pasando: fuga, falta de agua, agua turbia, etc.',
                  style: TextStyle(color: colores.secondaryText, fontSize: 13),
                ),
                const SizedBox(height: 16),
                if (ubicacion != null) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: colores.chipBackground,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(Icons.location_on_outlined, color: colores.info),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Ubicación registrada en tu cuenta',
                                style: TextStyle(
                                    fontSize: 12, color: colores.secondaryText),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                ubicacion,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w600),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  CheckboxListTile(
                    value: _ubicacionConfirmada,
                    onChanged: (v) =>
                        setState(() => _ubicacionConfirmada = v ?? false),
                    controlAffinity: ListTileControlAffinity.leading,
                    contentPadding: EdgeInsets.zero,
                    dense: true,
                    title: const Text(
                      '¿Confirmas que esta es la ubicación de la avería?',
                      style: TextStyle(fontSize: 13),
                    ),
                  ),
                ] else
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Text(
                      'Tu cuenta no tiene una dirección registrada. Contacta al '
                      'administrador del acueducto para poder reportar una avería.',
                      style: TextStyle(color: colores.danger, fontSize: 12.5),
                    ),
                  ),
                const SizedBox(height: 8),
                TextFormField(
                  controller: _descripcionCtrl,
                  minLines: 3,
                  maxLines: 6,
                  maxLength: 500,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: const InputDecoration(
                    hintText: 'Describe la avería…',
                    alignLabelWithHint: true,
                  ),
                  validator: (v) {
                    final t = v?.trim() ?? '';
                    if (t.isEmpty) return 'Cuéntanos qué ocurre';
                    if (t.length < 10) return 'Danos un poco más de detalle';
                    return null;
                  },
                ),
                const SizedBox(height: 8),
                FilledButton(
                  onPressed: (_enviando || ubicacion == null) ? null : _enviar,
                  child: _enviando
                      ? const SizedBox(
                          height: 22,
                          width: 22,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
                        )
                      : const Text('Enviar reporte'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
