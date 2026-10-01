import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/profile.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../utils/formato.dart';
import '../widgets/core/core.dart';

/// Formulario para que el propio usuario edite sus datos de perfil. El
/// backend solo permite un cambio cada [diasLimiteEdicionPerfil] días; si el
/// usuario ya consumió su cupo, esta pantalla lo muestra en modo lectura con
/// la fecha en que podrá volver a editar en vez del formulario.
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
          'numero_lote': _numeroLoteCtrl.text.trim(),
          'direccion': _direccionCtrl.text.trim(),
          'ocupacion': _ocupacionCtrl.text.trim(),
          'zona': _zonaCtrl.text.trim(),
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

  @override
  Widget build(BuildContext context) {
    final perfil = context.watch<AuthProvider>().profile;
    final proximaEdicion = perfil?.proximaEdicionDisponible;

    return GotaScaffold(
      appBar: const HidroAppBar(title: 'Editar perfil'),
      body: proximaEdicion != null
          ? _BloqueadoPorLimite(proximaEdicion: proximaEdicion)
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.of(context).chipBackground,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.info_outline, color: AppColors.of(context).info),
                      const SizedBox(width: 10),
                      const Expanded(
                        child: Text(
                          'Solo puedes editar tus datos una vez cada 30 días. '
                          'Revísalos bien antes de guardar.',
                          style: TextStyle(fontSize: 12.5),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
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
                            (v == null || v.trim().isEmpty) ? 'Requerido' : null,
                      ),
                      const SizedBox(height: 14),
                      TextFormField(
                        controller: _apellidoCtrl,
                        textCapitalization: TextCapitalization.words,
                        decoration: const InputDecoration(labelText: 'Apellido'),
                        validator: (v) =>
                            (v == null || v.trim().isEmpty) ? 'Requerido' : null,
                      ),
                      const SizedBox(height: 14),
                      TextFormField(
                        controller: _telefonoCtrl,
                        keyboardType: TextInputType.phone,
                        decoration: const InputDecoration(labelText: 'Teléfono'),
                      ),
                      const SizedBox(height: 14),
                      TextFormField(
                        controller: _numeroLoteCtrl,
                        decoration:
                            const InputDecoration(labelText: 'Número de lote'),
                      ),
                      const SizedBox(height: 14),
                      TextFormField(
                        controller: _direccionCtrl,
                        textCapitalization: TextCapitalization.sentences,
                        decoration:
                            const InputDecoration(labelText: 'Dirección'),
                      ),
                      const SizedBox(height: 14),
                      TextFormField(
                        controller: _zonaCtrl,
                        textCapitalization: TextCapitalization.words,
                        decoration: const InputDecoration(labelText: 'Zona'),
                      ),
                      const SizedBox(height: 14),
                      TextFormField(
                        controller: _ocupacionCtrl,
                        textCapitalization: TextCapitalization.sentences,
                        decoration:
                            const InputDecoration(labelText: 'Ocupación'),
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

class _BloqueadoPorLimite extends StatelessWidget {
  const _BloqueadoPorLimite({required this.proximaEdicion});

  final DateTime proximaEdicion;

  @override
  Widget build(BuildContext context) {
    final secundario = AppColors.of(context).secondaryText;
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.lock_clock_outlined, size: 56, color: secundario),
            const SizedBox(height: 16),
            const Text(
              'Ya editaste tu perfil este mes',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              'Podrás volver a editarlo a partir del ${Formato.fecha(proximaEdicion)}.',
              style: TextStyle(color: secundario),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
