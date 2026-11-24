import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../config/api_config.dart';
import '../providers/auth_provider.dart';
import '../providers/theme_provider.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import 'admin/admin_api.dart';
import 'admin/admin_pagos_screen.dart';
import 'cambiar_password_screen.dart';
import '../widgets/core/core.dart';
import 'editar_perfil_screen.dart';
import 'eliminar_cuenta.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

/// Pestaña "Perfil": muestra los datos de la cuenta del usuario, permite
/// editarlos y cerrar sesión.
class PerfilScreen extends StatelessWidget {
  const PerfilScreen({super.key});

  Future<void> _editarPerfil(BuildContext context) async {
    await Navigator.of(
      context,
    ).push(MaterialPageRoute(builder: (_) => const EditarPerfilScreen()));
  }

  Future<void> _cerrarSesion(BuildContext context) async {
    final confirmar = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cerrar sesión'),
        content: const Text('¿Seguro que quieres salir de tu cuenta?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Salir'),
          ),
        ],
      ),
    );
    if (confirmar != true || !context.mounted) return;

    try {
      await context.read<AuthProvider>().logout();
    } catch (_) {
      if (context.mounted) {
        AppSnackbar.error(
          context,
          'No se pudo cerrar sesión. Intenta de nuevo.',
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final perfil = context.watch<AuthProvider>().profile;
    final textTheme = Theme.of(context).textTheme;
    final colores = AppColors.of(context);
    final modoTema = context.watch<ThemeProvider>().modo;

    return GotaScaffold(
      appBar: const HidroAppBar(title: 'Mi perfil'),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Center(
            child: Column(
              children: [
                CircleAvatar(
                  radius: 40,
                  backgroundColor: colores.chipBackground,
                  child: const Icon(
                    LucideIcons.user,
                    color: Color.fromARGB(255, 91, 153, 247),
                    size: 44,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  perfil?.nombreCompleto ?? 'Usuario',
                  style: textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 4),
                Text(
                  perfil?.correo ?? '',
                  style: TextStyle(color: colores.secondaryText),
                ),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: colores.chipBackground,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    (perfil?.rol ?? '-').toUpperCase(),
                    style: TextStyle(
                      color: colores.info,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 28),
          Card(
            child: Column(
              children: [
                _Dato(
                  icono: LucideIcons.idCard,
                  etiqueta: 'Número de lote',
                  valor: perfil?.numeroLote,
                ),
                const Divider(height: 1),
                _Dato(
                  icono: LucideIcons.mapPin,
                  etiqueta: 'Dirección',
                  valor: perfil?.direccion,
                ),
                const Divider(height: 1),
                _Dato(
                  icono: LucideIcons.map,
                  etiqueta: 'Zona',
                  valor: perfil?.zona,
                ),
                const Divider(height: 1),
                _Dato(
                  icono: LucideIcons.phone,
                  etiqueta: 'Teléfono',
                  valor: perfil?.telefono,
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Ajustes',
                    style: textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Apariencia',
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      color: colores.secondaryText,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Elige cómo se ve la app en este dispositivo.',
                    style: TextStyle(
                      fontSize: 12.5,
                      color: colores.secondaryText,
                    ),
                  ),
                  const SizedBox(height: 14),
                  SegmentedButton<ThemeMode>(
                    segments: const [
                      ButtonSegment(
                        value: ThemeMode.light,
                        icon: Icon(LucideIcons.sun),
                        label: Text('Claro'),
                      ),
                      ButtonSegment(
                        value: ThemeMode.dark,
                        icon: Icon(LucideIcons.moon),
                        label: Text('Oscuro'),
                      ),
                      ButtonSegment(
                        value: ThemeMode.system,
                        icon: Icon(LucideIcons.settings2),
                        label: Text('Auto'),
                      ),
                    ],
                    selected: {modoTema},
                    showSelectedIcon: false,
                    onSelectionChanged: (seleccion) =>
                        context.read<ThemeProvider>().cambiar(seleccion.first),
                  ),
                  const _AjusteBiometria(),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          OutlinedButton.icon(
            onPressed: () => _editarPerfil(context),
            icon: const Icon(LucideIcons.pencil),
            label: const Text('Editar perfil'),
          ),
          const SizedBox(height: 8),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Text(
              perfil?.perfilCompleto == true
                  ? 'Para cambiar tu dirección, zona o lote, comunícate con el administrador.'
                  : 'Completa tu dirección, zona y lote para que el fontanero pueda ubicarte.',
              style: TextStyle(color: colores.secondaryText, fontSize: 12),
            ),
          ),
          if (perfil?.rol == 'administrador') ...[
            const SizedBox(height: 16),
            // Revisión de los recibos de pago físico que suben los usuarios.
            FilledButton.tonalIcon(
              key: const ValueKey('abrir-recibos-por-revisar'),
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => AdminPagosScreen(
                    api: AdminApi(context.read<AuthProvider>().api),
                  ),
                ),
              ),
              icon: const Icon(LucideIcons.receiptText),
              label: const Text('Recibos por revisar'),
            ),
          ],
          const SizedBox(height: 16),
          OutlinedButton.icon(
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const CambiarPasswordScreen()),
            ),
            icon: const Icon(LucideIcons.rotateCcwKey),
            label: const Text('Cambiar contraseña'),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppTheme.primary,
              side: const BorderSide(color: AppTheme.primary),
            ),
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: () => _cerrarSesion(context),
            icon: const Icon(LucideIcons.logOut),
            label: const Text('Cerrar sesión'),
            style: OutlinedButton.styleFrom(
              foregroundColor: colores.danger,
              side: BorderSide(color: colores.danger),
            ),
          ),
          const SizedBox(height: 12),
          // La política de privacidad va junto a "Eliminar cuenta" para que
          // el usuario pueda consultarla antes de decidir.
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  key: const ValueKey('abrir-politica-privacidad'),
                  onPressed: () => _abrirPaginaLegal(
                    context,
                    ApiConfig.politicaPrivacidadUrl,
                  ),
                  icon: const Icon(LucideIcons.shieldCheck),
                  label: const Text(
                    'Política de privacidad',
                    textAlign: TextAlign.center,
                  ),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: colores.info,
                    side: BorderSide(color: colores.info),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 10,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => solicitarEliminacionCuenta(
                    context,
                    perfil?.rol ?? 'usuario',
                  ),
                  icon: const Icon(Icons.delete_forever_outlined),
                  label: const Text(
                    'Eliminar cuenta',
                    textAlign: TextAlign.center,
                  ),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: colores.danger,
                    side: BorderSide(color: colores.danger),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 10,
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          const _InformacionLegal(),
        ],
      ),
    );
  }
}

/// Abre una de las páginas públicas legales (política de privacidad o
/// eliminación de cuenta) que exige Google Play.
Future<void> _abrirPaginaLegal(BuildContext context, String url) async {
  final uri = Uri.parse(url);
  var abierta = false;
  try {
    // Dentro de la app (pestaña del navegador); si el teléfono no lo
    // permite, se intenta con el navegador externo.
    abierta = await launchUrl(uri, mode: LaunchMode.inAppBrowserView);
    if (!abierta) {
      abierta = await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  } catch (_) {
    abierta = false;
  }
  if (!abierta && context.mounted) {
    AppSnackbar.error(
      context,
      'No se pudo abrir la página. Revisa tu conexión e intenta de nuevo.',
    );
  }
}

/// Enlace a la página pública de eliminación de cuenta (qué se borra y qué
/// se conserva). La política de privacidad está junto a "Eliminar cuenta".
class _InformacionLegal extends StatelessWidget {
  const _InformacionLegal();

  @override
  Widget build(BuildContext context) {
    final colores = AppColors.of(context);
    final textTheme = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 8),
          child: Text(
            'Información legal',
            style: textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w700,
              color: colores.secondaryText,
            ),
          ),
        ),
        Card(
          child: Column(
            children: [
              ListTile(
                key: const ValueKey('abrir-eliminar-cuenta'),
                leading: Icon(LucideIcons.fileText, color: colores.info),
                title: const Text('Eliminación de cuenta y datos'),
                subtitle: Text(
                  'Qué se borra y qué se conserva',
                  style: TextStyle(
                    fontSize: 12.5,
                    color: colores.secondaryText,
                  ),
                ),
                trailing: Icon(
                  LucideIcons.chevronRight,
                  color: colores.secondaryText,
                ),
                onTap: () =>
                    _abrirPaginaLegal(context, ApiConfig.eliminarCuentaUrl),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Interruptor "Iniciar sesión con huella o rostro". Solo aparece si el
/// dispositivo tiene biometría configurada. Una cuenta nueva entra siempre
/// con correo y contraseña hasta que el usuario lo active aquí.
class _AjusteBiometria extends StatefulWidget {
  const _AjusteBiometria();

  @override
  State<_AjusteBiometria> createState() => _AjusteBiometriaState();
}

class _AjusteBiometriaState extends State<_AjusteBiometria> {
  late final Future<bool> _soportada = context
      .read<AuthProvider>()
      .deviceSupportsBiometrics();
  bool _cambiando = false;

  Future<void> _cambiar(bool activar) async {
    setState(() => _cambiando = true);
    try {
      final hecho = await context.read<AuthProvider>().setBiometricEnabled(
        activar,
      );
      if (!mounted || !hecho) return;
      AppSnackbar.success(
        context,
        activar
            ? 'Listo. La próxima vez podrás entrar con tu huella o rostro.'
            : 'Ingreso con huella o rostro desactivado.',
      );
    } on ApiException catch (e) {
      if (mounted) AppSnackbar.error(context, e.message);
    } catch (_) {
      if (mounted) {
        AppSnackbar.error(
          context,
          'No se pudo validar la biometría. Intenta de nuevo.',
        );
      }
    } finally {
      if (mounted) setState(() => _cambiando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colores = AppColors.of(context);
    final activa = context.watch<AuthProvider>().biometricEnabled;
    return FutureBuilder<bool>(
      future: _soportada,
      builder: (context, snapshot) {
        if (snapshot.data != true) return const SizedBox.shrink();
        return Padding(
          padding: const EdgeInsets.only(top: 18),
          child: SwitchListTile(
            key: const ValueKey('ajuste-biometria'),
            contentPadding: EdgeInsets.zero,
            secondary: Icon(LucideIcons.fingerprint, color: colores.info),
            title: const Text('Iniciar sesión con huella o rostro'),
            subtitle: Text(
              activa
                  ? 'Al abrir la app te pediremos tu huella o rostro.'
                  : 'Desactivado: entras con tu correo y contraseña.',
              style: TextStyle(fontSize: 12.5, color: colores.secondaryText),
            ),
            value: activa,
            onChanged: _cambiando ? null : _cambiar,
          ),
        );
      },
    );
  }
}

class _Dato extends StatelessWidget {
  const _Dato({required this.icono, required this.etiqueta, this.valor});

  final IconData icono;
  final String etiqueta;
  final String? valor;

  @override
  Widget build(BuildContext context) {
    final texto = (valor == null || valor!.trim().isEmpty)
        ? 'Sin registrar'
        : valor!;
    final sinDato = texto == 'Sin registrar';
    final colores = AppColors.of(context);
    return ListTile(
      leading: Icon(icono, color: colores.info),
      title: Text(
        etiqueta,
        style: TextStyle(fontSize: 13, color: colores.secondaryText),
      ),
      subtitle: Text(
        texto,
        style: TextStyle(
          fontSize: 15,
          fontWeight: FontWeight.w600,
          color: sinDato
              ? colores.secondaryText
              : Theme.of(context).colorScheme.onSurface,
        ),
      ),
    );
  }
}
