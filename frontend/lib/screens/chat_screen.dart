import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';

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
  final _mensajes = <_Mensaje>[
    _Mensaje.asistente(
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
      _mensajes.add(_Mensaje.usuario(texto));
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
      setState(() => _mensajes.add(_Mensaje.asistente(respuesta)));
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _mensajes.add(_Mensaje.error(e.message)));
    } catch (_) {
      if (!mounted) return;
      setState(() => _mensajes.add(
            _Mensaje.error('Algo salió mal. Intenta de nuevo en un momento.'),
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
      (m) => m.autor == _Autor.usuario,
      orElse: () => _Mensaje.usuario(''),
    );
    if (ultimoUsuario.texto.isEmpty) return;
    setState(() => _mensajes.removeWhere((m) => m.autor == _Autor.error));
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
      appBar: AppBar(
        title: const Row(
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
                if (i == _mensajes.length) return const _BurbujaEscribiendo();
                return _Burbuja(
                  mensaje: _mensajes[i],
                  onReintentar: _mensajes[i].autor == _Autor.error
                      ? _reintentar
                      : null,
                );
              },
            ),
          ),
          _BarraEntrada(
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

// --- Modelo local -----------------------------------------------------------

enum _Autor { usuario, asistente, error }

class _Mensaje {
  _Mensaje(this.autor, this.texto);
  _Mensaje.usuario(String texto) : this(_Autor.usuario, texto);
  _Mensaje.asistente(String texto) : this(_Autor.asistente, texto);
  _Mensaje.error(String texto) : this(_Autor.error, texto);

  final _Autor autor;
  final String texto;
}

// --- Burbujas -------------------------------------------------------------

class _Burbuja extends StatelessWidget {
  const _Burbuja({required this.mensaje, this.onReintentar});

  final _Mensaje mensaje;
  final VoidCallback? onReintentar;

  @override
  Widget build(BuildContext context) {
    final esUsuario = mensaje.autor == _Autor.usuario;
    final esError = mensaje.autor == _Autor.error;

    final Color fondo;
    final Color texto;
    if (esUsuario) {
      fondo = AppTheme.primary;
      texto = Colors.white;
    } else if (esError) {
      fondo = const Color(0xFFFDECEA);
      texto = AppTheme.danger;
    } else {
      fondo = Colors.white;
      texto = Colors.black87;
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
                      ? const Color(0xFFF5C6C0)
                      : const Color(0xFFE3EEF4),
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
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.refresh, size: 16, color: AppTheme.danger),
                    SizedBox(width: 4),
                    Text(
                      'Reintentar',
                      style: TextStyle(
                        color: AppTheme.danger,
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

class _BurbujaEscribiendo extends StatelessWidget {
  const _BurbujaEscribiendo();

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(16),
            topRight: Radius.circular(16),
            bottomLeft: Radius.circular(4),
            bottomRight: Radius.circular(16),
          ),
          border: Border.all(color: const Color(0xFFE3EEF4)),
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              height: 16,
              width: 16,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: AppTheme.primary,
              ),
            ),
            SizedBox(width: 10),
            Text(
              'GOTA está escribiendo…',
              style: TextStyle(color: AppTheme.secondaryText, fontSize: 13),
            ),
          ],
        ),
      ),
    );
  }
}

// --- Barra de entrada ------------------------------------------------------

class _BarraEntrada extends StatelessWidget {
  const _BarraEntrada({
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
