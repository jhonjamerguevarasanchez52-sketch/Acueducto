import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../services/audio_gota_service.dart';
import '../theme/app_theme.dart';
import '../utils/lenguaje_ofensivo.dart';
import '../widgets/chat/chat.dart';
import '../widgets/core/app_snackbar.dart';
import '../widgets/core/hidro_app_bar.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

/// Pantalla del asistente virtual "GOTA". Conversación simple contra el
/// endpoint `POST /api/chat`, que responde `{ "respuesta": "..." }` y, si
/// GOTA propone avisar al fontanero, `accion: { tipo: 'confirmar_averia',
/// descripcion }`. La avería solo se registra al tocar el botón de esa acción.
///
/// El usuario también puede dictar por audio: `POST /api/chat/audio` devuelve
/// la transcripción, que llega al campo de texto para revisarla antes de
/// enviarla. Los ids de esos audios viajan en cada mensaje para que, si se
/// registra la avería, el fontanero pueda escucharlos.
///
/// El historial vive solo en memoria: al salir de la pantalla se pierde. Se
/// envían al backend los ocho turnos recientes para mantener el contexto sin
/// inflar cada petición.
class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key, this.audio});

  /// Se inyecta en pruebas; por defecto usa el micrófono real.
  final AudioGotaService? audio;

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _mensajes = <ChatMensaje>[
    ChatMensaje.asistente(
      '¡Hola! 💧 Soy GOTA, el asistente del acueducto Campo Amor. '
      'Puedo ayudarte con tus facturas, tarifas, pagos o a reportar una avería. '
      'Si prefieres, mándame un audio con el micrófono 🎤. '
      '¿En qué te echo una mano?',
    ),
  ];
  final _entradaCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  final _entradaFocus = FocusNode();
  late final AudioGotaService _audio = widget.audio ?? AudioGotaService();
  bool _enviando = false;

  EstadoAudio _estadoAudio = EstadoAudio.inactivo;
  Duration _grabado = Duration.zero;
  Timer? _relojGrabacion;

  /// El texto del campo salió de un audio y aún no se envía.
  bool _textoDeAudio = false;

  /// Audios enviados en esta conversación (se vinculan a la avería).
  final _audioIds = <String>[];

  /// Propuestas de avería ya confirmadas, para no mostrar el botón dos veces.
  final _confirmadas = <ChatMensaje>{};

  @override
  void initState() {
    super.initState();
    // Si el usuario borra todo el texto del audio, el aviso deja de aplicar.
    _entradaCtrl.addListener(() {
      if (_textoDeAudio && _entradaCtrl.text.trim().isEmpty) {
        setState(() => _textoDeAudio = false);
      }
    });
  }

  @override
  void dispose() {
    _relojGrabacion?.cancel();
    if (_estadoAudio == EstadoAudio.grabando) unawaited(_audio.cancelar());
    unawaited(_audio.dispose());
    _entradaCtrl.dispose();
    _scrollCtrl.dispose();
    _entradaFocus.dispose();
    super.dispose();
  }

  List<Map<String, String>> _historialHasta(int fin) {
    final historial = _mensajes
        .take(fin)
        .where((m) => m.autor != ChatAutor.error)
        .map((m) => <String, String>{
              'role': m.autor == ChatAutor.usuario ? 'user' : 'assistant',
              'content': m.texto,
            })
        .toList();
    final inicio = historial.length > 8 ? historial.length - 8 : 0;
    return historial.skip(inicio).toList();
  }

  Future<void> _enviar() async {
    final texto = _entradaCtrl.text.trim();
    if (texto.isEmpty || _enviando) return;

    // Las groserías no se envían ni se muestran: GOTA pide respeto.
    if (contieneLenguajeOfensivo(texto)) {
      setState(() {
        _mensajes.add(ChatMensaje.asistente(respuestaGotaLenguajeOfensivo));
        _textoDeAudio = false;
        _entradaCtrl.clear();
      });
      _bajarAlFinal();
      return;
    }

    final deAudio = _textoDeAudio;
    setState(() {
      _mensajes.add(ChatMensaje.usuario(texto, deAudio: deAudio));
      _textoDeAudio = false;
      _entradaCtrl.clear();
    });

    await _pedir(
      body: {
        'mensaje': texto,
        'historial': _historialHasta(_mensajes.length - 1),
      },
      enfocarAlFinal: true,
    );
  }

  /// El usuario tocó "Sí, avisar al fontanero" bajo una propuesta de GOTA.
  Future<void> _confirmarAveria(ChatMensaje propuesta) async {
    if (_enviando || _confirmadas.contains(propuesta)) return;
    setState(() {
      _confirmadas.add(propuesta);
      _mensajes.add(ChatMensaje.usuario('Sí, avisar al fontanero'));
    });
    final exito = await _pedir(body: {
      'confirmarAveria': true,
      'descripcion': propuesta.averiaPorConfirmar,
    });
    // Si falló, se puede volver a intentar desde el mismo botón.
    if (!exito && mounted) setState(() => _confirmadas.remove(propuesta));
  }

  /// Envía una petición a `/chat` y agrega la respuesta. Devuelve false si
  /// terminó en error.
  Future<bool> _pedir({
    required Map<String, Object?> body,
    bool enfocarAlFinal = false,
  }) async {
    setState(() => _enviando = true);
    _bajarAlFinal();
    var exito = false;

    try {
      final data = await context.read<AuthProvider>().api.post(
            '/chat',
            body: {...body, if (_audioIds.isNotEmpty) 'audioIds': _audioIds},
          );

      final respuesta = data is Map && data['respuesta'] is String
          ? (data['respuesta'] as String).trim()
          : 'No pude generar una respuesta.';
      final accion = data is Map ? data['accion'] : null;
      final descripcion = accion is Map &&
              accion['tipo'] == 'confirmar_averia' &&
              accion['descripcion'] is String
          ? accion['descripcion'] as String
          : null;

      if (!mounted) return false;
      setState(() => _mensajes.add(
            ChatMensaje.asistente(respuesta, averiaPorConfirmar: descripcion),
          ));
      exito = true;
    } on ApiException catch (e) {
      if (!mounted) return false;
      // Algunos rechazos traen una respuesta de GOTA en vez de un error.
      final respuesta = e.data is Map ? (e.data as Map)['respuesta'] : null;
      setState(() => _mensajes.add(
            respuesta is String
                ? ChatMensaje.asistente(respuesta)
                : ChatMensaje.error(e.message),
          ));
    } catch (_) {
      if (!mounted) return false;
      setState(() => _mensajes.add(
            ChatMensaje.error('Algo salió mal. Intenta de nuevo en un momento.'),
          ));
    } finally {
      if (mounted) {
        setState(() => _enviando = false);
        _bajarAlFinal();
        if (enfocarAlFinal) _entradaFocus.requestFocus();
      }
    }
    return exito;
  }

  /// Reintenta el último mensaje del usuario tras un error de red.
  void _reintentar() {
    final ultimoUsuario = _mensajes.lastWhere(
      (m) => m.autor == ChatAutor.usuario,
      orElse: () => ChatMensaje.usuario(''),
    );
    if (ultimoUsuario.texto.isEmpty) return;
    setState(() {
      _mensajes.removeWhere((m) => m.autor == ChatAutor.error);
      final indice = _mensajes.lastIndexWhere((m) => m.autor == ChatAutor.usuario);
      if (indice >= 0) _mensajes.removeAt(indice);
      _entradaCtrl.text = ultimoUsuario.texto;
      _textoDeAudio = ultimoUsuario.deAudio;
    });
    _enviar();
  }

  Future<void> _grabar() async {
    if (_estadoAudio != EstadoAudio.inactivo || _enviando) return;
    final bool permitido;
    try {
      permitido = await _audio.iniciar();
    } catch (_) {
      if (mounted) AppSnackbar.error(context, 'No se pudo usar el micrófono.');
      return;
    }
    if (!mounted) return;
    if (!permitido) {
      AppSnackbar.info(
        context,
        'Activa el permiso del micrófono para enviarle audios a GOTA.',
      );
      return;
    }
    _entradaFocus.unfocus();
    setState(() {
      _estadoAudio = EstadoAudio.grabando;
      _grabado = Duration.zero;
    });
    _relojGrabacion = Timer.periodic(const Duration(milliseconds: 250), (_) {
      if (!mounted) return;
      setState(() => _grabado = _audio.transcurrido);
      if (_grabado >= AudioGotaService.duracionMaxima) _terminarGrabacion();
    });
  }

  Future<void> _cancelarGrabacion() async {
    _relojGrabacion?.cancel();
    setState(() => _estadoAudio = EstadoAudio.inactivo);
    await _audio.cancelar().catchError((_) {});
  }

  Future<void> _terminarGrabacion() async {
    if (_estadoAudio != EstadoAudio.grabando) return;
    _relojGrabacion?.cancel();
    setState(() => _estadoAudio = EstadoAudio.transcribiendo);
    final api = context.read<AuthProvider>().api;

    try {
      final grabado = await _audio.detener();
      if (grabado == null || grabado.duracion < const Duration(seconds: 1)) {
        if (mounted) {
          AppSnackbar.info(context, 'El audio quedó muy corto. Mantén el micrófono un poco más.');
        }
        return;
      }
      final resultado = await AudioGotaService.transcribir(api, grabado);
      if (!mounted) return;
      if (resultado.audioId != null) _audioIds.add(resultado.audioId!);
      // Si ya había texto escrito, el audio se suma en vez de reemplazarlo.
      final previo = _entradaCtrl.text.trim();
      _entradaCtrl.text =
          previo.isEmpty ? resultado.transcripcion : '$previo ${resultado.transcripcion}';
      _entradaCtrl.selection =
          TextSelection.collapsed(offset: _entradaCtrl.text.length);
      setState(() => _textoDeAudio = true);
      _entradaFocus.requestFocus();
    } on ApiException catch (e) {
      if (mounted) AppSnackbar.error(context, e.message);
    } catch (_) {
      if (mounted) AppSnackbar.error(context, 'No se pudo procesar el audio.');
    } finally {
      if (mounted) setState(() => _estadoAudio = EstadoAudio.inactivo);
    }
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
    // Solo quien puede reportar averías envía audios: cuestan transcripción.
    final rol = context.watch<AuthProvider>().profile?.rol.trim().toLowerCase();
    final puedeEnviarAudios = rol == 'usuario' || rol == 'administrador';

    return Scaffold(
      appBar: const HidroAppBar(
        titleWidget: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircleAvatar(
              radius: 14,
              backgroundColor: Colors.white,
              child: Icon(LucideIcons.droplet, size: 16, color: AppTheme.primary),
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
                final mensaje = _mensajes[i];
                // El botón solo se ofrece en la propuesta más reciente.
                final puedeConfirmar = mensaje.averiaPorConfirmar != null &&
                    i == _mensajes.length - 1 &&
                    !_confirmadas.contains(mensaje);
                return ChatBurbuja(
                  mensaje: mensaje,
                  onReintentar: mensaje.autor == ChatAutor.error
                      ? _reintentar
                      : null,
                  onConfirmarAveria: puedeConfirmar && !_enviando
                      ? () => _confirmarAveria(mensaje)
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
            estadoAudio: _estadoAudio,
            grabado: _grabado,
            duracionMaxima: AudioGotaService.duracionMaxima,
            textoDeAudio: _textoDeAudio,
            onGrabar: puedeEnviarAudios ? _grabar : null,
            onTerminarGrabacion: _terminarGrabacion,
            onCancelarGrabacion: _cancelarGrabacion,
          ),
        ],
      ),
    );
  }
}
