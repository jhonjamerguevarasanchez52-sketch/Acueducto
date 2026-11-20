function textoPdf(valor) {
  return String(valor ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/[\\()]/g, '\\$&');
}

function linea(texto, x, y, size = 11, font = 'F1', color = '0.13 0.22 0.29') {
  return `BT /${font} ${size} Tf ${color} rg 1 0 0 1 ${x} ${y} Tm (${textoPdf(texto)}) Tj ET\n`;
}

function rect(x, y, width, height, color, stroke = false) {
  const operator = stroke ? 'RG' : 'rg';
  return `${color} ${operator} ${x} ${y} ${width} ${height} re ${stroke ? 'S' : 'f'}\n`;
}

function trazo(x1, y1, x2, y2, color = '0.82 0.88 0.91', width = 1) {
  return `${color} RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S\n`;
}

function circulo(cx, cy, radius, color, stroke = false) {
  const k = radius * 0.55228475;
  const operator = stroke ? 'RG' : 'rg';
  return `${color} ${operator} ${cx + radius} ${cy} m ${cx + radius} ${cy + k} ${cx + k} ${cy + radius} ${cx} ${cy + radius} c ${cx - k} ${cy + radius} ${cx - radius} ${cy + k} ${cx - radius} ${cy} c ${cx - radius} ${cy - k} ${cx - k} ${cy - radius} ${cx} ${cy - radius} c ${cx + k} ${cy - radius} ${cx + radius} ${cy - k} ${cx + radius} ${cy} c ${stroke ? 'S' : 'f'}\n`;
}

// Emblema vectorial inspirado en el logo HIDRO-APP: anillo, puntos cardinales y gota.
function logoAcueducto() {
  let stream = circulo(78, 786, 23, '0.78 0.92 0.97', true);
  stream += circulo(78, 763, 3.1, '0.36 0.75 0.86');
  stream += circulo(101, 786, 3.1, '0.36 0.75 0.86');
  stream += circulo(78, 809, 3.1, '0.36 0.75 0.86');
  stream += circulo(55, 786, 3.1, '0.36 0.75 0.86');
  stream += `0.40 0.78 0.88 rg 78 770 m 91 786 91 793 78 802 c 65 793 65 786 78 770 c f\n`;
  stream += `1 1 1 rg 78 781 m 84 794 l 78 790 l 72 794 l h f\n`;
  return stream;
}

function envolver(texto, maxCaracteres = 78) {
  const palabras = String(texto || '').split(/\s+/).filter(Boolean);
  const lineas = [];
  let actual = '';
  for (const palabra of palabras) {
    const candidato = actual ? `${actual} ${palabra}` : palabra;
    if (candidato.length > maxCaracteres && actual) {
      lineas.push(actual);
      actual = palabra;
    } else actual = candidato;
  }
  if (actual) lineas.push(actual);
  return lineas;
}

function contenidoCertificado(certificado) {
  const perfil = certificado.profile_snapshot || {};
  const nombre = `${perfil.nombre || ''} ${perfil.apellido || ''}`.trim() || certificado.full_name || 'Perfil';
  const fecha = new Date(certificado.generated_at || Date.now()).toLocaleDateString('es-CO');
  const certificadoNo = certificado.certificate_number || 'SIN NUMERO';
  let stream = '';

  // Cabecera de marca y acento de color.
  stream += rect(0, 0, 595, 842, '1 1 1');
  stream += rect(0, 690, 595, 152, '0.04 0.20 0.37');
  stream += rect(0, 686, 595, 4, '0.22 0.68 0.82');
  stream += logoAcueducto();
  stream += linea('ASOCIACION DEL ACUEDUCTO REGIONAL CAMPOAMOR', 124, 809, 8, 'F2', '0.72 0.88 0.95');
  stream += linea('NIT 900.790.925-0', 124, 794, 8, 'F1', '0.72 0.88 0.95');
  stream += linea('CERTIFICADO DE', 124, 773, 21, 'F2', '1 1 1');
  stream += linea('PAZ Y SALVO', 124, 745, 21, 'F2', '1 1 1');
  stream += rect(424, 746, 126, 29, '0.10 0.34 0.51');
  stream += linea(`No. ${certificadoNo}`, 434, 757, 9, 'F2', '0.91 0.97 0.99');

  // Estado de cuenta destacado.
  stream += rect(55, 632, 485, 34, '0.91 0.97 0.95');
  stream += circulo(75, 649, 8, '0.13 0.58 0.43');
  stream += `1 1 1 rg 71 649 m 74 646 l 80 653 l 78 655 l 74 650 l 72 652 l h f\n`;
  stream += linea('ESTADO DE CUENTA: AL DIA', 92, 645, 11, 'F2', '0.09 0.42 0.33');
  stream += linea('Saldo pendiente: $0 COP', 382, 645, 9, 'F2', '0.09 0.42 0.33');

  stream += linea('A QUIEN CORRESPONDA', 55, 594, 10, 'F2', '0.19 0.35 0.45');
  stream += linea('LA ADMINISTRACION DEL ACUEDUCTO CAMPO AMOR', 55, 572, 12, 'F2', '0.04 0.20 0.37');
  stream += linea('CERTIFICA QUE:', 55, 545, 10, 'F2', '0.04 0.20 0.37');

  // Panel de titular.
  stream += rect(55, 477, 485, 51, '0.96 0.98 0.99');
  stream += rect(55, 477, 4, 51, '0.22 0.68 0.82');
  stream += linea('TITULAR DEL SERVICIO', 72, 507, 8, 'F2', '0.37 0.49 0.55');
  stream += linea(nombre, 72, 487, 13, 'F2', '0.04 0.20 0.37');

  let y = 444;
  const datos = [];
  if (perfil.cedula) datos.push(`Cedula: ${perfil.cedula}`);
  if (perfil.correo) datos.push(`Correo: ${perfil.correo}`);
  if (perfil.numero_lote) datos.push(`Numero de lote: ${perfil.numero_lote}`);
  if (perfil.direccion) datos.push(`Direccion: ${perfil.direccion}`);
  if (perfil.zona) datos.push(`Zona: ${perfil.zona}`);
  for (const dato of datos) {
    for (const lineaDato of envolver(dato, 88)) {
      stream += linea(lineaDato, 62, y, 9, 'F1', '0.32 0.43 0.49');
      y -= 15;
    }
  }

  const declaracion = `Que ${nombre}${perfil.cedula ? `, identificado(a) con cedula No. ${perfil.cedula},` : ''} se encuentra a paz y salvo por concepto de las facturas registradas hasta la fecha de expedicion de este certificado (${fecha}).`;
  const parrafoY = Math.min(y - 23, 392);
  let textoY = parrafoY;
  for (const texto of envolver(declaracion, 88)) {
    stream += linea(texto, 62, textoY, 10, 'F1', '0.16 0.27 0.33');
    textoY -= 17;
  }

  const notaY = Math.max(textoY - 25, 305);
  stream += trazo(55, notaY + 15, 540, notaY + 15, '0.86 0.91 0.93', 1);
  stream += linea('Este documento refleja el estado de cuenta a la fecha indicada.', 55, notaY, 9, 'F1', '0.37 0.49 0.55');
  stream += linea('No incluye obligaciones que se generen con posterioridad.', 55, notaY - 15, 9, 'F1', '0.37 0.49 0.55');

  const firmaY = Math.max(notaY - 104, 175);
  stream += linea('Atentamente,', 55, firmaY + 39, 10, 'F1', '0.30 0.42 0.48');
  stream += trazo(55, firmaY + 15, 235, firmaY + 15, '0.43 0.58 0.65', 0.8);
  stream += linea('ADMINISTRACION', 55, firmaY - 2, 9, 'F2', '0.04 0.20 0.37');
  stream += linea('Asociacion del Acueducto Regional Campoamor', 55, firmaY - 17, 8, 'F1', '0.37 0.49 0.55');

  // Pie de pagina y folio de validacion.
  stream += rect(0, 0, 595, 55, '0.96 0.98 0.99');
  stream += trazo(0, 55, 595, 55, '0.84 0.90 0.93', 1);
  stream += linea(`Expedido el ${fecha}`, 55, 32, 8, 'F1', '0.37 0.49 0.55');
  stream += linea(certificadoNo, 390, 32, 8, 'F2', '0.04 0.20 0.37');
  return stream;
}

function contenidoPertenencia(perfil) {
  const nombre = `${perfil.nombre || ''} ${perfil.apellido || ''}`.trim() || 'Usuario';
  const cedula = perfil.cedula || 'No registrada';
  const fecha = new Date().toLocaleDateString('es-CO');
  let stream = rect(0, 0, 595, 842, '1 1 1');
  stream += rect(0, 690, 595, 152, '0.04 0.20 0.37');
  stream += rect(0, 686, 595, 4, '0.22 0.68 0.82');
  stream += logoAcueducto();
  stream += linea('ASOCIACION DEL ACUEDUCTO REGIONAL CAMPOAMOR', 124, 805, 9, 'F2', '0.72 0.88 0.95');
  stream += linea('NIT 900.790.925-0', 124, 787, 9, 'F1', '0.72 0.88 0.95');
  stream += linea('CERTIFICADO DE', 55, 625, 20, 'F2', '0.04 0.20 0.37');
  stream += linea('PERTENENCIA', 55, 596, 20, 'F2', '0.04 0.20 0.37');
  stream += linea('A QUIEN CORRESPONDA', 55, 535, 10, 'F2', '0.19 0.35 0.45');
  stream += linea('LA ADMINISTRACION CERTIFICA QUE:', 55, 505, 12, 'F2', '0.04 0.20 0.37');
  stream += rect(55, 426, 485, 55, '0.96 0.98 0.99');
  stream += rect(55, 426, 4, 55, '0.22 0.68 0.82');
  stream += linea(nombre, 72, 458, 14, 'F2', '0.04 0.20 0.37');
  stream += linea(`Cedula de ciudadania: ${cedula}`, 72, 438, 10, 'F1', '0.32 0.43 0.49');
  const texto = `${nombre}, identificado(a) con cedula de ciudadania No. ${cedula}, pertenece a la Asociacion del Acueducto Regional Campoamor, identificada con NIT 900.790.925-0.`;
  envolver(texto, 82).forEach((lineaTexto, index) => {
    stream += linea(lineaTexto, 62, 375 - index * 18, 11, 'F1', '0.16 0.27 0.33');
  });
  stream += linea(`Se expide el ${fecha} a solicitud del interesado.`, 62, 300, 10, 'F1', '0.16 0.27 0.33');
  stream += linea('Atentamente,', 55, 205, 10, 'F1', '0.30 0.42 0.48');
  stream += trazo(55, 180, 250, 180, '0.43 0.58 0.65', 0.8);
  stream += linea('ADMINISTRACION', 55, 163, 9, 'F2', '0.04 0.20 0.37');
  stream += linea('Asociacion del Acueducto Regional Campoamor', 55, 146, 9, 'F1', '0.37 0.49 0.55');
  stream += rect(0, 0, 595, 55, '0.96 0.98 0.99');
  stream += trazo(0, 55, 595, 55, '0.84 0.90 0.93', 1);
  stream += linea('NIT 900.790.925-0', 55, 32, 8, 'F2', '0.04 0.20 0.37');
  return stream;
}

function generarPdf(certificados, renderContenido) {
  const lista = certificados || [];
  if (!lista.length) throw new Error('No hay certificados para generar.');
  const objetos = [];
  objetos[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objetos[2] = `<< /Type /Pages /Kids [${lista.map((_, index) => `${5 + index * 2} 0 R`).join(' ')}] /Count ${lista.length} >>`;
  objetos[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objetos[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';

  lista.forEach((certificado, index) => {
    const pageId = 5 + index * 2;
    const contentId = pageId + 1;
    const stream = renderContenido(certificado);
    objetos[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
    objetos[contentId] = `<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}endstream`;
  });

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let id = 1; id < objetos.length; id += 1) {
    offsets[id] = Buffer.byteLength(pdf, 'ascii');
    pdf += `${id} 0 obj\n${objetos[id]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, 'ascii');
  pdf += `xref\n0 ${objetos.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objetos.length; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objetos.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, 'ascii');
}

function generarPdfPazYSalvos(certificados) {
  return generarPdf(certificados, contenidoCertificado);
}

function generarPdfPertenencia(perfil) {
  return generarPdf([perfil], contenidoPertenencia);
}

module.exports = { generarPdfPazYSalvos, generarPdfPertenencia };
