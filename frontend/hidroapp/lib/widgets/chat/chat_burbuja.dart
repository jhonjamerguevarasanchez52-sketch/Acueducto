import 'package:flutter/material.dart';

import '../../theme/app_theme.dart';
import 'chat_mensaje.dart';

/// Burbuja de un mensaje del chat. Alineada a la derecha y en azul si es del
/// usuario; a la izquierda, blanca (o roja si es un error) si es del asistente.
/// Los mensajes de error muestran un enlace "Reintentar".
class ChatBurbuja extends StatelessWidget {
  const ChatBurbuja({super.key, required this.mensaje, this.onReintentar});

  final ChatMensaje mensaje;
  final VoidCallback? onReintentar;

  @override
  Widget build(BuildContext context) {
    final esUsuario = mensaje.autor == ChatAutor.usuario;
    final esError = mensaje.autor == ChatAutor.error;
    final colores = AppColors.of(context);
    final esOscuro = Theme.of(context).brightness == Brightness.dark;

    final Color fondo;
    final Color texto;
    if (esUsuario) {
      fondo = AppTheme.primary;
      texto = Colors.white;
    } else if (esError) {
      fondo = esOscuro ? const Color(0xFF3B211F) : const Color(0xFFFDECEA);
      texto = colores.danger;
    } else {
      fondo = colores.cardBackground;
      texto = Theme.of(context).colorScheme.onSurface;
    }

    return Align(
      alignment: esUsuario ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.78,
        ),
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: fondo,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(16),
            topRight: const Radius.circular(16),
            bottomLeft: Radius.circular(esUsuario ? 16 : 4),
            bottomRight: Radius.circular(esUsuario ? 4 : 16),
          ),
          border: esUsuario
              ? null
              : Border.all(
                  color: esError
                      ? colores.danger.withValues(alpha: 0.35)
                      : colores.cardBorder,
                ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              mensaje.texto,
              style: TextStyle(color: texto, fontSize: 15, height: 1.35),
            ),
            if (onReintentar != null) ...[
              const SizedBox(height: 6),
              GestureDetector(
                onTap: onReintentar,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.refresh, size: 16, color: colores.danger),
                    const SizedBox(width: 4),
                    Text(
                      'Reintentar',
                      style: TextStyle(
                        color: colores.danger,
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Burbuja "GOTA está escribiendo…" que se muestra mientras se espera la
/// respuesta del backend.
class ChatBurbujaEscribiendo extends StatelessWidget {
  const ChatBurbujaEscribiendo({super.key});

  @override
  Widget build(BuildContext context) {
    final colores = AppColors.of(context);
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: colores.cardBackground,
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(16),
            topRight: Radius.circular(16),
            bottomLeft: Radius.circular(4),
            bottomRight: Radius.circular(16),
          ),
          border: Border.all(color: colores.cardBorder),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(
              height: 16,
              width: 16,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: AppTheme.primary,
              ),
            ),
            const SizedBox(width: 10),
            Text(
              'GOTA está escribiendo…',
              style: TextStyle(color: colores.secondaryText, fontSize: 13),
            ),
          ],
        ),
      ),
    );
  }
}
