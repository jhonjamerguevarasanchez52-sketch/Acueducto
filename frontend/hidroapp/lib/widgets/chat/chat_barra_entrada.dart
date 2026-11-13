import 'package:flutter/material.dart';

import '../../theme/app_theme.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

/// Estado del micrófono de la barra del chat.
enum EstadoAudio { inactivo, grabando, transcribiendo }

/// Barra inferior del chat: campo de texto multilínea y botón de envío.
///
/// Con el campo vacío, el botón de envío se cambia por un micrófono
/// ([onGrabar]). Mientras graba, la barra muestra el tiempo y los botones
/// para descartar o terminar el audio; al terminar, la transcripción llega
/// al campo de texto para que el usuario la revise antes de enviarla.
class ChatBarraEntrada extends StatelessWidget {
  const ChatBarraEntrada({
    super.key,
    required this.controller,
    required this.focusNode,
    required this.habilitada,
    required this.onEnviar,
    this.estadoAudio = EstadoAudio.inactivo,
    this.grabado = Duration.zero,
    this.duracionMaxima = const Duration(seconds: 60),
    this.textoDeAudio = false,
    this.onGrabar,
    this.onTerminarGrabacion,
    this.onCancelarGrabacion,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final bool habilitada;
  final VoidCallback onEnviar;

  final EstadoAudio estadoAudio;
  final Duration grabado;
  final Duration duracionMaxima;

  /// El texto del campo viene de un audio: se muestra un aviso para revisarlo.
  final bool textoDeAudio;

  /// Null cuando el usuario no puede enviar audios (por ejemplo, sin sesión).
  final VoidCallback? onGrabar;
  final VoidCallback? onTerminarGrabacion;
  final VoidCallback? onCancelarGrabacion;

  @override
  Widget build(BuildContext context) {
    final colores = AppColors.of(context);
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
        decoration: BoxDecoration(
          color: colores.cardBackground,
          border: Border(top: BorderSide(color: colores.cardBorder)),
        ),
        child: switch (estadoAudio) {
          EstadoAudio.grabando => _grabando(colores),
          EstadoAudio.transcribiendo => _transcribiendo(colores),
          EstadoAudio.inactivo => _escribiendo(colores),
        },
      ),
    );
  }

  Widget _escribiendo(AppColors colores) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (textoDeAudio)
          Padding(
            padding: const EdgeInsets.only(left: 4, bottom: 6),
            child: Row(
              children: [
                Icon(LucideIcons.mic, size: 15, color: colores.info),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    'Esto entendí de tu audio. Corrígelo si hace falta y envíalo.',
                    style: TextStyle(fontSize: 12.5, color: colores.info),
                  ),
                ),
              ],
            ),
          ),
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: TextField(
                controller: controller,
                focusNode: focusNode,
                minLines: 1,
                maxLines: 4,
                maxLength: 1000,
                textCapitalization: TextCapitalization.sentences,
                textInputAction: TextInputAction.send,
                onSubmitted: (_) => onEnviar(),
                decoration: const InputDecoration(
                  hintText: 'Escribe tu mensaje…',
                  counterText: '',
                  contentPadding:
                      EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                ),
              ),
            ),
            const SizedBox(width: 8),
            // El micrófono aparece solo con el campo vacío, como en las apps
            // de mensajería: así el botón de envío no cambia bajo el dedo.
            ValueListenableBuilder<TextEditingValue>(
              valueListenable: controller,
              builder: (context, valor, _) {
                final usarMicrofono =
                    onGrabar != null && valor.text.trim().isEmpty;
                return IconButton.filled(
                  tooltip: usarMicrofono ? 'Enviar un audio' : 'Enviar',
                  onPressed: !habilitada
                      ? null
                      : usarMicrofono
                          ? onGrabar
                          : onEnviar,
                  icon: Icon(
                    usarMicrofono ? LucideIcons.mic : LucideIcons.send,
                  ),
                  style: _estiloBoton(AppTheme.primary),
                );
              },
            ),
          ],
        ),
      ],
    );
  }

  Widget _grabando(AppColors colores) {
    final restante = duracionMaxima - grabado;
    return Row(
      children: [
        IconButton(
          tooltip: 'Descartar audio',
          onPressed: onCancelarGrabacion,
          icon: Icon(LucideIcons.trash2, color: colores.danger),
        ),
        Expanded(
          child: Row(
            children: [
              Icon(LucideIcons.circleSmall, size: 14, color: colores.danger),
              const SizedBox(width: 8),
              Text(
                _formato(grabado),
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  fontFeatures: [FontFeature.tabularFigures()],
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  restante.inSeconds <= 10
                      ? 'Quedan ${restante.inSeconds} s'
                      : 'Cuéntale a GOTA qué pasó',
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 13, color: colores.secondaryText),
                ),
              ),
            ],
          ),
        ),
        IconButton.filled(
          tooltip: 'Terminar audio',
          onPressed: onTerminarGrabacion,
          icon: const Icon(LucideIcons.check),
          style: _estiloBoton(AppTheme.primary),
        ),
      ],
    );
  }

  Widget _transcribiendo(AppColors colores) {
    return SizedBox(
      height: 48,
      child: Row(
        children: [
          const SizedBox(width: 12),
          const SizedBox(
            height: 18,
            width: 18,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: AppTheme.primary,
            ),
          ),
          const SizedBox(width: 12),
          Text(
            'GOTA está escuchando tu audio…',
            style: TextStyle(fontSize: 14, color: colores.secondaryText),
          ),
        ],
      ),
    );
  }

  static ButtonStyle _estiloBoton(Color color) => IconButton.styleFrom(
        minimumSize: const Size(48, 48),
        backgroundColor: color,
        disabledBackgroundColor: const Color(0xFFBFD9E7),
      );

  static String _formato(Duration d) =>
      '${d.inMinutes}:${(d.inSeconds % 60).toString().padLeft(2, '0')}';
}
