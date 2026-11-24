import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../widgets/core/app_snackbar.dart';

/// Solicita la confirmación y elimina la cuenta autenticada desde el perfil.
Future<void> solicitarEliminacionCuenta(
  BuildContext context,
  String rol,
) async {
  final datos = await showDialog<Map<String, String>>(
    context: context,
    builder: (_) => _DialogoEliminarCuenta(rol: rol),
  );
  if (datos == null || !context.mounted) return;

  try {
    await context.read<AuthProvider>().eliminarCuenta(
      passwordActual: datos['password']!,
      nota: rol == 'fontanero' ? datos['nota'] : null,
    );
  } on ApiException catch (error) {
    if (context.mounted) AppSnackbar.error(context, error.message);
  } catch (_) {
    // Fallos que no vienen del servidor (por ejemplo, del almacenamiento del
    // teléfono): no se muestra el detalle técnico.
    if (context.mounted) {
      AppSnackbar.error(
        context,
        'No se pudo eliminar la cuenta. Revisa tu conexión e intenta de nuevo.',
      );
    }
  }
}

class _DialogoEliminarCuenta extends StatefulWidget {
  const _DialogoEliminarCuenta({required this.rol});

  final String rol;

  @override
  State<_DialogoEliminarCuenta> createState() => _DialogoEliminarCuentaState();
}

class _DialogoEliminarCuentaState extends State<_DialogoEliminarCuenta> {
  final _password = TextEditingController();
  final _nota = TextEditingController();

  @override
  void dispose() {
    _password.dispose();
    _nota.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Eliminar cuenta'),
    content: SingleChildScrollView(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text(
            'La cuenta se eliminará inmediatamente. Se guardará un historial administrativo y recibirás un correo con las facturas que queden pendientes.',
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _password,
            obscureText: true,
            autofocus: true,
            decoration: const InputDecoration(labelText: 'Contraseña actual'),
          ),
          if (widget.rol == 'fontanero') ...[
            const SizedBox(height: 12),
            TextField(
              controller: _nota,
              minLines: 2,
              maxLines: 4,
              decoration: const InputDecoration(
                labelText: 'Nota de salida (obligatoria)',
              ),
            ),
          ],
        ],
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('Cancelar'),
      ),
      FilledButton(
        style: FilledButton.styleFrom(backgroundColor: Colors.red.shade700),
        onPressed: () {
          if (_password.text.trim().isEmpty ||
              (widget.rol == 'fontanero' && _nota.text.trim().isEmpty)) {
            return;
          }
          Navigator.pop(context, {
            'password': _password.text,
            'nota': _nota.text,
          });
        },
        child: const Text('Eliminar definitivamente'),
      ),
    ],
  );
}
