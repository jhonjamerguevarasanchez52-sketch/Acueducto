/// Modelo local de un turno de la conversación con el asistente "GOTA". El
/// historial vive solo en memoria mientras la pantalla del chat está abierta.
enum ChatAutor { usuario, asistente, error }

class ChatMensaje {
  ChatMensaje(
    this.autor,
    this.texto, {
    this.deAudio = false,
    this.averiaPorConfirmar,
  });
  ChatMensaje.usuario(String texto, {bool deAudio = false})
      : this(ChatAutor.usuario, texto, deAudio: deAudio);
  ChatMensaje.asistente(String texto, {String? averiaPorConfirmar})
      : this(ChatAutor.asistente, texto, averiaPorConfirmar: averiaPorConfirmar);
  ChatMensaje.error(String texto) : this(ChatAutor.error, texto);

  final ChatAutor autor;
  final String texto;

  /// El usuario lo dictó por audio (es la transcripción que revisó).
  final bool deAudio;

  /// Descripción que GOTA propone enviar al fontanero. Si no es null, la
  /// burbuja muestra el botón "Sí, avisar al fontanero".
  final String? averiaPorConfirmar;
}
