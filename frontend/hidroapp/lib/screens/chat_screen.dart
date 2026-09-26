import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../widgets/chat/chat.dart';
import '../widgets/core/hidro_app_bar.dart';

/// Pantalla del asistente virtual "GOTA". Conversación simple contra el
/// endpoint `POST /api/chat`, que responde `{ "respuesta": "..." }`.
///
/// El historial vive solo en memoria: al salir de la pantalla se pierde. El
/// backend, por ahora, responde cada mensaje de forma independiente (no recibe
/// los turnos anteriores).
class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _mensajes = <ChatMensaje>[
    ChatMensaje.asistente(
      '¡Hola! 💧 Soy GOTA, el asistente del acueducto Campo Amor. '
      'Puedo ayudarte con tus facturas, tarifas, pagos o a reportar una avería. '
      '¿En qué te echo una mano?',
    ),
  ];
  final _entradaCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  final _entradaFocus = FocusNode();
  bool _enviando = false;

  @override
  void dispose() {
    _entradaCtrl.dispose();
    _scrollCtrl.dispose();
    _entradaFocus.dispose();
    super.dispose();
  }

  Future<void> _enviar() async {
    final texto = _entradaCtrl.text.trim();
    if (texto.isEmpty || _enviando) return;

    setState(() {
      _mensajes.add(ChatMensaje.usuario(texto));
      _enviando = true;
      _entradaCtrl.clear();
    });
    _bajarAlFinal();

    try {
      final data = await context
          .read<AuthProvider>()
          .api
          .post('/chat', body: {'mensaje': texto});

      final respuesta = data is Map && data['respuesta'] is String
          ? (data['respuesta'] as String).trim()
          : 'No pude generar una respuesta.';

      if (!mounted) return;
      setState(() => _mensajes.add(ChatMensaje.asistente(respuesta)));
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _mensajes.add(ChatMensaje.error(e.message)));
    } catch (_) {
      if (!mounted) return;
      setState(() => _mensajes.add(
            ChatMensaje.error('Algo salió mal. Intenta de nuevo en un momento.'),
          ));
    } finally {
      if (mounted) {
        setState(() => _enviando = false);
        _bajarAlFinal();
        _entradaFocus.requestFocus();
      }
    }
  }

  /// Reintenta el último mensaje del usuario tras un error de red.
  void _reintentar() {
    final ultimoUsuario = _mensajes.lastWhere(
      (m) => m.autor == ChatAutor.usuario,
      orElse: () => ChatMensaje.usuario(''),
    );
    if (ultimoUsuario.texto.isEmpty) return;
    setState(() => _mensajes.removeWhere((m) => m.autor == ChatAutor.error));
    _entradaCtrl.text = ultimoUsuario.texto;
    _enviar();
  }

  void _bajarAlFinal() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollCtrl.hasClients) return;
      _scrollCtrl.animateTo(
        _scrollCtrl.position.maxScrollExtent,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const HidroAppBar(
        titleWidget: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircleAvatar(
              radius: 14,
              backgroundColor: Colors.white,
              child: Icon(Icons.water_drop, size: 16, color: AppTheme.primary),
            ),
            SizedBox(width: 10),
            Text('GOTA'),
          ],
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView.builder(
              controller: _scrollCtrl,
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              itemCount: _mensajes.length + (_enviando ? 1 : 0),
              itemBuilder: (context, i) {
                if (i == _mensajes.length) return const ChatBurbujaEscribiendo();
                return ChatBurbuja(
                  mensaje: _mensajes[i],
                  onReintentar: _mensajes[i].autor == ChatAutor.error
                      ? _reintentar
                      : null,
                );
              },
            ),
          ),
          ChatBarraEntrada(
            controller: _entradaCtrl,
            focusNode: _entradaFocus,
            habilitada: !_enviando,
            onEnviar: _enviar,
          ),
        ],
      ),
    );
  }
}
