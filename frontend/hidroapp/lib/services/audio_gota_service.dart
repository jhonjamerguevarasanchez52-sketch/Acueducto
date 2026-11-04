import 'dart:io';

import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';

import 'api_service.dart';

/// Audio ya grabado, listo para enviar a GOTA.
class AudioGrabado {
  AudioGrabado(this.bytes, this.duracion);

  final List<int> bytes;
  final Duration duracion;
}

/// Lo que devuelve `POST /api/chat/audio`. [audioId] es null si el backend
/// no pudo guardar el archivo (el texto igual sirve).
class AudioTranscrito {
  AudioTranscrito(this.transcripcion, this.audioId);

  final String transcripcion;
  final String? audioId;
}

/// Graba los audios que el usuario le envía a GOTA y los manda al backend
/// para transcribirlos.
///
/// Formato pensado para pesar poco por datos móviles: AAC mono a 16 kHz y
/// 32 kbps (~240 KB por minuto), suficiente para la voz y para Whisper.
class AudioGotaService {
  AudioGotaService({AudioRecorder? grabadora}) : _creada = grabadora;

  static const duracionMaxima = Duration(seconds: 60);

  static const _config = RecordConfig(
    encoder: AudioEncoder.aacLc,
    bitRate: 32000,
    sampleRate: 16000,
    numChannels: 1,
  );

  // Se crea al primer uso del micrófono: abrir el chat no toca el plugin.
  AudioRecorder? _creada;
  AudioRecorder get _grabadora => _creada ??= AudioRecorder();
  final _cronometro = Stopwatch();
  String? _ruta;

  Duration get transcurrido => _cronometro.elapsed;

  /// Devuelve false si el usuario no dio permiso para usar el micrófono.
  Future<bool> iniciar() async {
    if (!await _grabadora.hasPermission()) return false;
    final carpeta = await getTemporaryDirectory();
    _ruta = '${carpeta.path}/gota_${DateTime.now().millisecondsSinceEpoch}.m4a';
    await _grabadora.start(_config, path: _ruta!);
    _cronometro
      ..reset()
      ..start();
    return true;
  }

  /// Detiene la grabación y devuelve el audio. El archivo temporal se borra
  /// apenas se lee: el audio solo queda guardado en el backend.
  Future<AudioGrabado?> detener() async {
    _cronometro.stop();
    final ruta = await _grabadora.stop() ?? _ruta;
    if (ruta == null) return null;
    final archivo = File(ruta);
    if (!await archivo.exists()) return null;
    final bytes = await archivo.readAsBytes();
    await archivo.delete().catchError((_) => archivo);
    if (bytes.isEmpty) return null;
    return AudioGrabado(bytes, _cronometro.elapsed);
  }

  Future<void> cancelar() async {
    _cronometro.stop();
    await _grabadora.cancel();
  }

  Future<void> dispose() async => _creada?.dispose();

  static Future<AudioTranscrito> transcribir(
    ApiService api,
    AudioGrabado audio,
  ) async {
    final segundos = audio.duracion.inMilliseconds / 1000;
    final data = await api.postBytes(
      '/chat/audio',
      bytes: audio.bytes,
      contentType: 'audio/mp4',
      headers: {'X-Audio-Duracion': segundos.ceil().toString()},
    );
    final texto = data is Map && data['transcripcion'] is String
        ? (data['transcripcion'] as String).trim()
        : '';
    if (texto.isEmpty) {
      throw ApiException('No logré entender el audio. Intenta de nuevo.');
    }
    final audioId = data is Map ? data['audioId'] : null;
    return AudioTranscrito(texto, audioId is String ? audioId : null);
  }
}
