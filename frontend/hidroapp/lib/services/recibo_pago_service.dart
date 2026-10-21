import 'package:image_picker/image_picker.dart';

import 'api_service.dart';

class ReciboPagoService {
  static const _maxBytes = 5 * 1024 * 1024;
  static final _picker = ImagePicker();

  /// Abre la galería y envía la imagen al backend, que la guarda en privado.
  /// Devuelve false si el usuario cancela el selector.
  static Future<bool> subir(ApiService api, String facturaId) async {
    final imagen = await _picker
        .pickImage(
          source: ImageSource.gallery,
          imageQuality: 82,
          maxWidth: 1600,
          maxHeight: 1600,
        )
        .catchError((_) => throw ApiException('No se pudo abrir la galería.'));
    if (imagen == null) return false;

    final List<int> bytes;
    try {
      bytes = await imagen.readAsBytes();
    } catch (_) {
      throw ApiException('No se pudo leer la imagen seleccionada.');
    }
    if (bytes.isEmpty || bytes.length > _maxBytes) {
      throw ApiException('La imagen del recibo debe pesar máximo 5 MB.');
    }

    final tipo = _tipoImagen(bytes);
    if (tipo == null) {
      throw ApiException('Selecciona una imagen JPG, PNG o WEBP del recibo.');
    }

    await api.postBytes(
      '/pagos/$facturaId/recibo',
      bytes: bytes,
      contentType: tipo,
    );
    return true;
  }

  static String? _tipoImagen(List<int> bytes) {
    if (bytes.length >= 3 && bytes[0] == 0xff && bytes[1] == 0xd8 && bytes[2] == 0xff) {
      return 'image/jpeg';
    }
    if (bytes.length >= 8 &&
        bytes.take(8).join(',') == '137,80,78,71,13,10,26,10') {
      return 'image/png';
    }
    if (bytes.length >= 12 &&
        String.fromCharCodes(bytes.take(4)) == 'RIFF' &&
        String.fromCharCodes(bytes.skip(8).take(4)) == 'WEBP') {
      return 'image/webp';
    }
    return null;
  }
}
