/// Utilidades de formato para la app del Acueducto Campo Amor.
///
/// Se hacen a mano, sin depender de los datos de locale de `intl`, para no
/// tener que inicializar `initializeDateFormatting` en el arranque ni volver
/// asíncrono el `main`. El acueducto es de un único municipio colombiano, así
/// que basta con pesos (COP, sin decimales) y fechas en español.
class Formato {
  Formato._();

  static const _meses = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ];

  /// `12345.6` -> `"$ 12.346"`. Redondea al peso y agrupa los miles con punto.
  static String pesos(num? valor) {
    if (valor == null) return '\$ 0';
    final negativo = valor < 0;
    final digitos = valor.abs().round().toString();
    final buffer = StringBuffer();
    for (var i = 0; i < digitos.length; i++) {
      if (i > 0 && (digitos.length - i) % 3 == 0) buffer.write('.');
      buffer.write(digitos[i]);
    }
    return '${negativo ? '-' : ''}\$ $buffer';
  }

  /// `DateTime(2026, 9, 7)` -> `"7 de septiembre de 2026"`.
  static String fecha(DateTime? fecha) {
    if (fecha == null) return '—';
    final d = fecha.toLocal();
    return '${d.day} de ${_meses[d.month - 1]} de ${d.year}';
  }

  /// Igual que [fecha] pero con la hora: `"7 de septiembre de 2026 · 14:05"`.
  static String fechaHora(DateTime? fecha) {
    if (fecha == null) return '—';
    final d = fecha.toLocal();
    final hh = d.hour.toString().padLeft(2, '0');
    final mm = d.minute.toString().padLeft(2, '0');
    return '${Formato.fecha(d)} · $hh:$mm';
  }

  /// `"2026-09"` -> `"septiembre de 2026"`. Si no reconoce el formato lo
  /// devuelve tal cual (el periodo lo escribe el administrador a mano).
  static String periodo(String? periodo) {
    if (periodo == null || periodo.isEmpty) return '—';
    final m = RegExp(r'^(\d{4})-(\d{1,2})$').firstMatch(periodo.trim());
    if (m == null) return periodo;
    final anio = int.parse(m.group(1)!);
    final mes = int.parse(m.group(2)!);
    if (mes < 1 || mes > 12) return periodo;
    return '${_meses[mes - 1]} de $anio';
  }

  /// Convierte a texto legible un identificador con guiones bajos:
  /// `"en_proceso"` -> `"En proceso"`.
  static String etiqueta(String? valor) {
    if (valor == null || valor.isEmpty) return '—';
    final limpio = valor.replaceAll('_', ' ').trim();
    return limpio[0].toUpperCase() + limpio.substring(1);
  }
}

/// Parsea una fecha ISO 8601 del backend a [DateTime]. Devuelve `null` si el
/// valor viene vacío o con un formato que Dart no entiende, en vez de lanzar.
DateTime? parsearFecha(dynamic valor) {
  if (valor == null) return null;
  final texto = valor.toString();
  if (texto.isEmpty) return null;
  return DateTime.tryParse(texto);
}
