/// Modelo local de un turno de la conversación con el asistente "GOTA". El
/// historial vive solo en memoria mientras la pantalla del chat está abierta.
enum ChatAutor { usuario, asistente, error }

class ChatMensaje {
  ChatMensaje(this.autor, this.texto);
  ChatMensaje.usuario(String texto) : this(ChatAutor.usuario, texto);
  ChatMensaje.asistente(String texto) : this(ChatAutor.asistente, texto);
  ChatMensaje.error(String texto) : this(ChatAutor.error, texto);

  final ChatAutor autor;
  final String texto;
}
