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
  final password = TextEditingController();
  final nota = TextEditingController();
  final datos = await showDialog<Map<String, String>>(
    context: context,
    builder: (ctx) => AlertDialog(
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
              controller: password,
              obscureText: true,
              autofocus: true,
              decoration: const InputDecoration(labelText: 'Contraseña actual'),
            ),
            if (rol == 'fontanero') ...[
              const SizedBox(height: 12),
              TextField(
                controller: nota,
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
          onPressed: () => Navigator.pop(ctx),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          style: FilledButton.styleFrom(backgroundColor: Colors.red.shade700),
          onPressed: () {
            if (password.text.trim().isEmpty ||
                (rol == 'fontanero' && nota.text.trim().isEmpty)) {
              return;
            }
            Navigator.pop(ctx, {'password': password.text, 'nota': nota.text});
          },
          child: const Text('Eliminar definitivamente'),
        ),
      ],
    ),
  );

  final passwordActual = password.text;
  final notaSalida = nota.text;
  password.dispose();
  nota.dispose();
  if (datos == null || !context.mounted) return;

  try {
    await context.read<AuthProvider>().eliminarCuenta(
      passwordActual: datos['password'] ?? passwordActual,
      nota: rol == 'fontanero' ? (datos['nota'] ?? notaSalida) : null,
    );
  } on ApiException catch (error) {
    if (context.mounted) AppSnackbar.error(context, error.message);
  } catch (error) {
    if (context.mounted) AppSnackbar.error(context, error.toString());
  }
}
