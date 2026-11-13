import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../utils/lenguaje_ofensivo.dart';
import '../widgets/core/core.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

/// Formulario para que el propio usuario edite sus datos de perfil.
///
/// Nombre, teléfono y ocupación se corrigen cuando quiera. Dirección, zona y
/// número de lote identifican el servicio: si ya están registrados se
/// muestran en solo lectura (los cambia el administrador); si están vacíos,
/// el usuario los puede llenar una vez.
class EditarPerfilScreen extends StatefulWidget {
  const EditarPerfilScreen({super.key});

  @override
  State<EditarPerfilScreen> createState() => _EditarPerfilScreenState();
}

class _EditarPerfilScreenState extends State<EditarPerfilScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nombreCtrl;
  late final TextEditingController _apellidoCtrl;
  late final TextEditingController _telefonoCtrl;
  late final TextEditingController _numeroLoteCtrl;
  late final TextEditingController _direccionCtrl;
  late final TextEditingController _ocupacionCtrl;
  late final TextEditingController _zonaCtrl;
  late final bool _loteBloqueado;
  late final bool _direccionBloqueada;
  late final bool _zonaBloqueada;
  bool _guardando = false;

  @override
  void initState() {
    super.initState();
    final perfil = context.read<AuthProvider>().profile;
    _nombreCtrl = TextEditingController(text: perfil?.nombre);
    _apellidoCtrl = TextEditingController(text: perfil?.apellido);
    _telefonoCtrl = TextEditingController(text: perfil?.telefono);
    _numeroLoteCtrl = TextEditingController(text: perfil?.numeroLote);
    _direccionCtrl = TextEditingController(text: perfil?.direccion);
    _ocupacionCtrl = TextEditingController(text: perfil?.ocupacion);
    _zonaCtrl = TextEditingController(text: perfil?.zona);
    _loteBloqueado = perfil?.ubicacionBloqueada(perfil.numeroLote) ?? false;
    _direccionBloqueada = perfil?.ubicacionBloqueada(perfil.direccion) ?? false;
    _zonaBloqueada = perfil?.ubicacionBloqueada(perfil.zona) ?? false;
  }

  @override
  void dispose() {
    _nombreCtrl.dispose();
    _apellidoCtrl.dispose();
    _telefonoCtrl.dispose();
    _numeroLoteCtrl.dispose();
    _direccionCtrl.dispose();
    _ocupacionCtrl.dispose();
    _zonaCtrl.dispose();
    super.dispose();
  }

  bool get _hayUbicacionBloqueada =>
      _loteBloqueado || _direccionBloqueada || _zonaBloqueada;

  Future<void> _guardar() async {
    if (!_formKey.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() => _guardando = true);
    try {
      await context.read<AuthProvider>().api.put(
        '/profile/mi-perfil',
        body: {
          'nombre': _nombreCtrl.text.trim(),
          'apellido': _apellidoCtrl.text.trim(),
          'telefono': _telefonoCtrl.text.trim(),
          'ocupacion': _ocupacionCtrl.text.trim(),
          // Solo se envían los datos de ubicación que todavía se pueden llenar.
          if (!_loteBloqueado) 'numero_lote': _numeroLoteCtrl.text.trim(),
          if (!_direccionBloqueada) 'direccion': _direccionCtrl.text.trim(),
          if (!_zonaBloqueada) 'zona': _zonaCtrl.text.trim(),
        },
      );
      if (!mounted) return;
      await context.read<AuthProvider>().refreshProfile();
      if (!mounted) return;
      AppSnackbar.success(context, 'Perfil actualizado');
      Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _guardando = false);
        AppSnackbar.error(context, e.message);
      }
    }
  }

  Widget _campoUbicacion({
    required TextEditingController controller,
    required String etiqueta,
    required bool bloqueado,
    TextCapitalization capitalizacion = TextCapitalization.sentences,
  }) {
    return TextFormField(
      controller: controller,
      readOnly: bloqueado,
      enabled: !bloqueado,
      textCapitalization: capitalizacion,
      validator: bloqueado ? null : validarSinGroserias,
      decoration: InputDecoration(
        labelText: etiqueta,
        suffixIcon: bloqueado ? const Icon(LucideIcons.lock, size: 18) : null,
        helperText: bloqueado ? 'Lo cambia el administrador' : 'Escríbelo con cuidado: luego solo lo cambia el administrador',
        helperMaxLines: 2,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colores = AppColors.of(context);
    return GotaScaffold(
      appBar: const HidroAppBar(title: 'Editar perfil'),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          if (_hayUbicacionBloqueada) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: colores.chipBackground,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Icon(LucideIcons.info, color: colores.info),
                  const SizedBox(width: 10),
                  const Expanded(
                    child: Text(
                      'Tu dirección, zona y lote identifican tu servicio. Si cambiaron, '
                      'avísale al administrador del acueducto para actualizarlos.',
                      style: TextStyle(fontSize: 12.5),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
          ],
          Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextFormField(
                  controller: _nombreCtrl,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(labelText: 'Nombre'),
                  validator: (v) =>
                      (v == null || v.trim().isEmpty)
                          ? 'Requerido'
                          : validarSinGroserias(v),
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: _apellidoCtrl,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(labelText: 'Apellido'),
                  validator: (v) =>
                      (v == null || v.trim().isEmpty)
                          ? 'Requerido'
                          : validarSinGroserias(v),
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: _telefonoCtrl,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(labelText: 'Teléfono'),
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: _ocupacionCtrl,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: const InputDecoration(labelText: 'Ocupación'),
                  validator: validarSinGroserias,
                ),
                const SizedBox(height: 14),
                _campoUbicacion(
                  controller: _direccionCtrl,
                  etiqueta: 'Dirección',
                  bloqueado: _direccionBloqueada,
                ),
                const SizedBox(height: 14),
                _campoUbicacion(
                  controller: _zonaCtrl,
                  etiqueta: 'Zona',
                  bloqueado: _zonaBloqueada,
                  capitalizacion: TextCapitalization.words,
                ),
                const SizedBox(height: 14),
                _campoUbicacion(
                  controller: _numeroLoteCtrl,
                  etiqueta: 'Número de lote',
                  bloqueado: _loteBloqueado,
                ),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: _guardando ? null : _guardar,
                  child: _guardando
                      ? const SizedBox(
                          height: 22,
                          width: 22,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
                        )
                      : const Text('Guardar cambios'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
