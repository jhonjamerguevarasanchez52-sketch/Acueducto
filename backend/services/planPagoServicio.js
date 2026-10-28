const PERIODO_VALIDO = /^\d{4}-(0[1-9]|1[0-2])$/;
const MESES_DISPONIBLES = [1, 6, 12];

function agregarMeses(periodo, cantidad) {
  if (!PERIODO_VALIDO.test(periodo)) throw new Error('El periodo debe tener el formato AAAA-MM.');
  const [anio, mes] = periodo.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1 + cantidad, 1));
  return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}`;
}

function calcularPeriodosPlan(periodoInicio, meses) {
  if (!MESES_DISPONIBLES.includes(Number(meses))) {
    throw new Error('El plan debe cubrir 1, 6 o 12 meses.');
  }
  if (!PERIODO_VALIDO.test(periodoInicio)) {
    throw new Error('El periodo inicial de la factura no es válido.');
  }

  const cantidad = Number(meses);
  const periodoFin = agregarMeses(periodoInicio, cantidad - 1);
  const proximoPeriodo = agregarMeses(periodoFin, 1);

  return {
    periodoInicio,
    periodoFin,
    meses: cantidad,
    periodos: Array.from({ length: cantidad }, (_, indice) => agregarMeses(periodoInicio, indice)),
    proximoPeriodo,
    fechaProximaFacturacion: `${agregarMeses(proximoPeriodo, 1)}-01`,
  };
}

const NOMBRES_MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

// '2026-10' -> 'octubre de 2026'. Devuelve el texto tal cual si no es AAAA-MM.
function nombrePeriodo(periodo) {
  if (!PERIODO_VALIDO.test(String(periodo || ''))) return String(periodo || '');
  const [anio, mes] = periodo.split('-').map(Number);
  return `${NOMBRES_MESES[mes - 1]} de ${anio}`;
}

// Todos los meses entre inicio y fin (inclusive). Si fin falta, solo inicio.
function listarPeriodos(inicio, fin = inicio) {
  if (!PERIODO_VALIDO.test(String(inicio || ''))) return [];
  const ultimo = PERIODO_VALIDO.test(String(fin || '')) ? fin : inicio;
  const periodos = [];
  for (let actual = inicio; actual <= ultimo && periodos.length < 24; actual = agregarMeses(actual, 1)) {
    periodos.push(actual);
  }
  return periodos;
}

const esPeriodoValido = (periodo) => PERIODO_VALIDO.test(String(periodo ?? ''));

module.exports = {
  MESES_DISPONIBLES,
  esPeriodoValido,
  calcularPeriodosPlan,
  agregarMeses,
  listarPeriodos,
  nombrePeriodo,
};
