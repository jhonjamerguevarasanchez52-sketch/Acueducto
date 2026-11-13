import 'dart:async';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';

import '../../models/averia.dart';
import '../../theme/app_theme.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

/// Pide al backend un enlace temporal para reproducir [audio]. Devuelve null
/// si ya no se puede escuchar (quien la implementa avisa al usuario).
typedef ObtenerUrlAudio = Future<String?> Function(AveriaAudio audio);

/// Audio que el usuario le envió a GOTA, dentro de la tarjeta de la avería
/// que ve el fontanero. Muestra cuánto falta para que se borre el archivo;
/// la transcripción ya va en la descripción de la avería y no se borra.
class AveriaAudioTile extends StatefulWidget {
  const AveriaAudioTile({
    super.key,
    required this.audio,
    required this.onObtenerUrl,
    this.reproductor,
  });

  final AveriaAudio audio;
  final ObtenerUrlAudio onObtenerUrl;

  /// Se inyecta en pruebas.
  final AudioPlayer? reproductor;

  @override
  State<AveriaAudioTile> createState() => _AveriaAudioTileState();
}

class _AveriaAudioTileState extends State<AveriaAudioTile> {
  AudioPlayer? _reproductor;
  StreamSubscription<PlayerState>? _estadoSub;
  bool _cargando = false;
  bool _sonando = false;
  late bool _disponible = widget.audio.disponible;
  late DateTime? _expiraEn = widget.audio.expiraEn;
  late bool _escuchado = widget.audio.escuchadoEn != null;

  @override
  void dispose() {
    _estadoSub?.cancel();
    _reproductor?.dispose();
    super.dispose();
  }

  AudioPlayer _obtenerReproductor() {
    final existente = _reproductor;
    if (existente != null) return existente;
    final nuevo = widget.reproductor ?? AudioPlayer();
    _estadoSub = nuevo.onPlayerStateChanged.listen((estado) {
      if (mounted) setState(() => _sonando = estado == PlayerState.playing);
    });
    return _reproductor = nuevo;
  }

  Future<void> _alternar() async {
    if (_cargando) return;
    final reproductor = _obtenerReproductor();
    if (_sonando) {
      await reproductor.pause();
      return;
    }
    // Los enlaces vencen a los 5 minutos: se pide uno nuevo en cada
    // reproducción desde el inicio.
    if (reproductor.state == PlayerState.paused) {
      await reproductor.resume();
      return;
    }

    setState(() => _cargando = true);
    try {
      final url = await widget.onObtenerUrl(widget.audio);
      if (!mounted) return;
      if (url == null) {
        setState(() => _disponible = false);
        return;
      }
      // La primera escucha del fontanero inicia la cuenta de 72 horas.
      if (!_escuchado) {
        final limite = DateTime.now().add(const Duration(hours: 72));
        setState(() {
          _escuchado = true;
          if (_expiraEn == null || _expiraEn!.isAfter(limite)) _expiraEn = limite;
        });
      }
      await reproductor.play(UrlSource(url));
    } finally {
      if (mounted) setState(() => _cargando = false);
    }
  }

  String _vence() {
    final expira = _expiraEn;
    if (expira == null) return '';
    final restante = expira.difference(DateTime.now());
    if (restante.inMinutes <= 0) return 'Se borra en unos minutos';
    if (restante.inHours < 1) return 'Se borra en ${restante.inMinutes} min';
    if (restante.inHours < 48) return 'Se borra en ${restante.inHours} h';
    return 'Se borra en ${restante.inDays} días';
  }

  @override
  Widget build(BuildContext context) {
    final colores = AppColors.of(context);
    final duracion = widget.audio.duracionS;
    final etiqueta = 'Audio del usuario · '
        '${duracion ~/ 60}:${(duracion % 60).toString().padLeft(2, '0')}';

    return Container(
      margin: const EdgeInsets.only(top: 10),
      padding: const EdgeInsets.fromLTRB(4, 4, 12, 4),
      decoration: BoxDecoration(
        color: colores.chipBackground,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          if (_disponible)
            IconButton(
              tooltip: _sonando ? 'Pausar audio' : 'Escuchar audio',
              onPressed: _alternar,
              icon: _cargando
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Icon(
                      _sonando
                          ? LucideIcons.circlePause
                          : LucideIcons.circlePlay,
                      color: AppTheme.primary,
                      size: 30,
                    ),
            )
          else
            Padding(
              padding: const EdgeInsets.all(12),
              child: Icon(LucideIcons.micOff, color: colores.secondaryText),
            ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  etiqueta,
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                ),
                Text(
                  _disponible
                      ? '🎧 ${_vence()}. La transcripción queda guardada.'
                      : 'El audio ya se borró. La transcripción quedó en la descripción.',
                  style: TextStyle(fontSize: 12, color: colores.secondaryText),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
