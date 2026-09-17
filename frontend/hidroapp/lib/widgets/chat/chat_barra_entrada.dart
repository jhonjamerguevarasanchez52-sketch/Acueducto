import 'package:flutter/material.dart';

import '../../theme/app_theme.dart';

/// Barra inferior del chat: campo de texto multilínea y botón de envío.
class ChatBarraEntrada extends StatelessWidget {
  const ChatBarraEntrada({
    super.key,
    required this.controller,
    required this.focusNode,
    required this.habilitada,
    required this.onEnviar,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final bool habilitada;
  final VoidCallback onEnviar;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: Color(0xFFE3EEF4))),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: TextField(
                controller: controller,
                focusNode: focusNode,
                minLines: 1,
                maxLines: 4,
                maxLength: 500,
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
            IconButton.filled(
              onPressed: habilitada ? onEnviar : null,
              icon: const Icon(Icons.send_rounded),
              style: IconButton.styleFrom(
                minimumSize: const Size(48, 48),
                backgroundColor: AppTheme.primary,
                disabledBackgroundColor: const Color(0xFFBFD9E7),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
