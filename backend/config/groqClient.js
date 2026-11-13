const Groq = require('groq-sdk');

// El cliente se crea perezosamente (no al cargar el módulo): así, si falta
// GROQ_API_KEY, solo fallan las rutas de GOTA en vez de tumbar todo el
// servidor al arrancar (el SDK de Groq lanza en su constructor si no hay API key).
let groq = null;

function obtenerGroq() {
  if (!process.env.GROQ_API_KEY) return null;
  if (!groq) groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return groq;
}

module.exports = { obtenerGroq };
