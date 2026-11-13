import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import '../../utils/lenguaje_ofensivo.dart';
import '../core/app_snackbar.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

/// Problemas frecuentes: el usuario toca uno en vez de escribir. El texto del
/// botón se convierte en el inicio de la descripción que recibe el fontanero.
const tiposAveria = <(IconData, String)>[
  (LucideIcons.droplet, 'No llega el agua'),
  (LucideIcons.wrench, 'Fuga de agua'),
  (LucideIcons.gauge, 'Baja presión'),
  (LucideIcons.droplets, 'Agua turbia o con mal olor'),
  (LucideIcons.timer, 'Daño en el contador'),
  (LucideIcons.ellipsis, 'Otro problema'),
];

const _otroProblema = 'Otro problema';

/// Arma la descripción que se envía al backend a partir del tipo elegido y
/// del detalle opcional. Con "Otro problema" el detalle es la descripción.
String descripcionAveria(String? tipo, String detalle) {
  final texto = detalle.trim();
  if (tipo == null || tipo == _otroProblema) return texto;
  return texto.isEmpty ? tipo : '$tipo. $texto';
}

/// Hoja inferior con el formulario para reportar una nueva avería. Devuelve
/// `true` por `Navigator.pop` cuando el reporte se crea con éxito.
class FormularioReporteAveria extends StatefulWidget {
  const FormularioReporteAveria({
    super.key,
    required this.esAdministrador,
    required this.onCerrar,
  });

  final bool esAdministrador;
  final VoidCallback onCerrar;

  @override
  State<FormularioReporteAveria> createState() =>
      _FormularioReporteAveriaState();
}

class _FormularioReporteAveriaState extends State<FormularioReporteAveria> {
  final _formKey = GlobalKey<FormState>();
  final _detalleCtrl = TextEditingController();
  final _ubicacionCtrl = TextEditingController();
  String? _tipo;
  bool _enviando = false;

  @override
  void dispose() {
    _detalleCtrl.dispose();
    _ubicacionCtrl.dispose();
    super.dispose();
  }

  Future<void> _enviar() async {
    if (_tipo == null) {
      AppSnackbar.error(context, 'Toca el tipo de problema que tienes');
      return;
    }
    if (!_formKey.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() => _enviando = true);
    try {
      final api = context.read<AuthProvider>().api;
      await api.post(
        '/averias',
        body: {
          'descripcion': descripcionAveria(_tipo, _detalleCtrl.text),
          // La ubicación se muestra encima del botón de envío: enviar es
          // confirmar que la avería está ahí.
          'ubicacionConfirmada': true,
          if (widget.esAdministrador) 'ubicacion': _ubicacionCtrl.text.trim(),
        },
      );
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _enviando = false);
        AppSnackbar.error(context, e.message);
      }
    } catch (_) {
      if (mounted) {
        setState(() => _enviando = false);
        AppSnackbar.error(
          context,
          'No se pudo enviar el reporte. Revisa tu conexión e inténtalo de nuevo.',
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final fondo = MediaQuery.of(context).viewInsets.bottom;
    final perfil = context.watch<AuthProvider>().profile;
    final ubicacion = perfil?.ubicacionCuenta;
    final puedeReportar = widget.esAdministrador || ubicacion != null;
    final colores = AppColors.of(context);
    final esOtro = _tipo == _otroProblema;
    return PopScope(
      canPop: !_enviando,
      child: Padding(
        padding: EdgeInsets.only(bottom: fondo),
        child: Container(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(context).size.height * 0.92,
          ),
          decoration: BoxDecoration(
            color: colores.cardBackground,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          ),
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
          child: SafeArea(
            top: false,
            child: SingleChildScrollView(
              child: Form(
                key: _formKey,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    SizedBox(
                      height: 28,
                      child: Stack(
                        alignment: Alignment.topCenter,
                        children: [
                          Container(
                            width: 40,
                            height: 4,
                            margin: const EdgeInsets.only(top: 4),
                            decoration: BoxDecoration(
                              color: const Color(0xFFDCE7EF),
                              borderRadius: BorderRadius.circular(2),
                            ),
                          ),
                          Align(
                            alignment: Alignment.centerRight,
                            child: IconButton(
                              onPressed: _enviando ? null : widget.onCerrar,
                              icon: const Icon(LucideIcons.x),
                              tooltip: 'Cerrar',
                              visualDensity: VisualDensity.compact,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Text(
                      'Reportar una avería',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '¿Qué está pasando? Toca una opción.',
                      style: TextStyle(color: colores.secondaryText, fontSize: 13),
                    ),
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final (icono, etiqueta) in tiposAveria)
                          ChoiceChip(
                            key: ValueKey('tipo-averia-$etiqueta'),
                            avatar: Icon(icono, size: 18),
                            label: Text(etiqueta),
                            selected: _tipo == etiqueta,
                            onSelected: _enviando
                                ? null
                                : (_) => setState(() => _tipo = etiqueta),
                          ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _detalleCtrl,
                      minLines: 2,
                      maxLines: 5,
                      maxLength: 500,
                      textCapitalization: TextCapitalization.sentences,
                      decoration: InputDecoration(
                        labelText: esOtro ? 'Cuéntanos qué ocurre' : 'Detalle (opcional)',
                        hintText: 'Ej.: desde esta mañana sale agua por el tubo junto al portón.',
                        alignLabelWithHint: true,
                      ),
                      validator: (v) {
                        final t = v?.trim() ?? '';
                        if (esOtro && t.length < 10) {
                          return 'Describe el problema en pocas palabras (mínimo 10 letras)';
                        }
                        return validarSinGroserias(t);
                      },
                    ),
                    const SizedBox(height: 8),
                    if (widget.esAdministrador)
                      TextFormField(
                        controller: _ubicacionCtrl,
                        maxLength: 200,
                        textCapitalization: TextCapitalization.sentences,
                        decoration: const InputDecoration(
                          labelText: 'Ubicación de la avería',
                          hintText: 'Dirección, zona o número de lote',
                          prefixIcon: Icon(LucideIcons.mapPin),
                        ),
                        validator: (value) {
                          if (value == null || value.trim().isEmpty) {
                            return 'Indica dónde está la avería';
                          }
                          return validarSinGroserias(value);
                        },
                      )
                    else if (ubicacion != null)
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: colores.chipBackground,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(LucideIcons.mapPin, color: colores.info),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'El fontanero irá a tu dirección registrada',
                                    style: TextStyle(fontSize: 12, color: colores.secondaryText),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    ubicacion,
                                    style: const TextStyle(fontWeight: FontWeight.w600),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      )
                    else
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Text(
                          'Tu cuenta no tiene una dirección registrada. Agrégala en '
                          'Perfil > Editar perfil para poder reportar una avería.',
                          style: TextStyle(color: colores.danger, fontSize: 12.5),
                        ),
                      ),
                    const SizedBox(height: 16),
                    FilledButton.icon(
                      onPressed: (_enviando || !puedeReportar) ? null : _enviar,
                      icon: _enviando
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Icon(LucideIcons.send),
                      label: const Text('Avisar al fontanero'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
