import 'package:flutter/material.dart';

import '../../theme/app_theme.dart';

/// AppBar con degradado y una pequeña animación de entrada para el título
/// (se desliza y aparece cada vez que se monta la pantalla), en vez del
/// título plano por defecto. Se usa en lugar de `AppBar` en las pantallas
/// internas para que todas compartan el mismo look-and-feel.
class HidroAppBar extends StatelessWidget implements PreferredSizeWidget {
  const HidroAppBar({
    super.key,
    this.title,
    this.titleWidget,
    this.actions,
  }) : assert(title != null || titleWidget != null,
            'HidroAppBar necesita `title` o `titleWidget`');

  final String? title;
  final Widget? titleWidget;
  final List<Widget>? actions;

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    return AppBar(
      backgroundColor: Colors.transparent,
      elevation: 0,
      flexibleSpace: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [AppTheme.primary, AppTheme.primaryDark],
          ),
        ),
      ),
      title: _TituloAnimado(
        child: titleWidget ?? Text(title!),
      ),
      actions: actions,
    );
  }
}

/// Desliza y desvanece el título hacia dentro cada vez que la pantalla que
/// lo contiene se monta, en vez de aparecer estático de golpe.
class _TituloAnimado extends StatelessWidget {
  const _TituloAnimado({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: AppTheme.motionEntrada,
      curve: Curves.easeOutCubic,
      builder: (context, valor, hijo) => Opacity(
        opacity: valor,
        child: Transform.translate(
          offset: Offset((1 - valor) * -18, 0),
          child: hijo,
        ),
      ),
      child: child,
    );
  }
}
