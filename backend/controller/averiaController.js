const breakdownModel = require('../models/breakdownModel');
const supabaseAdmin = require('../config/supabaseAdminClient');
const { notificar } = require('../utils/notificar');
const { enviarCorreo } = require('../config/mailer');
const { errorInesperado, errorConsulta } = require('../utils/httpErrores');
const { escaparHtml } = require('../utils/html');

const ESTADOS_VALIDOS = ['reportada', 'en_proceso', 'resuelta', 'cancelada'];

// Avisa por correo al/los fontanero(s) activos de una nueva avería reportada.
// No lanza: si falla el envío, se registra el error y se sigue, para no
// tumbar el reporte de la avería por un problema de correo.
async function avisarFontaneroPorCorreo(averia) {
  try {
    const [{ data: fontaneros, error }, { data: reportante }] = await Promise.all([
      supabaseAdmin
      .from('profiles')
      .select('id,correo')
      .eq('rol', 'fontanero')
      .eq('activo', true),
      supabaseAdmin
        .from('profiles')
        .select('nombre,apellido,correo,telefono,zona,direccion')
        .eq('id', averia.perfil_id)
        .maybeSingle(),
    ]);

    if (error) throw error;
    if (!fontaneros || fontaneros.length === 0) return;

    const nombre = [reportante?.nombre, reportante?.apellido].filter(Boolean).join(' ') || 'No disponible';
    const ubicacion = [averia.direccion || reportante?.direccion, averia.zona || reportante?.zona]
      .filter(Boolean).join(' · ') || 'No registrada';
    const html = `<p>Se reportó una nueva avería:</p>
      <p><strong>Reportó:</strong> ${escaparHtml(nombre)}</p>
      <p><strong>Correo:</strong> ${escaparHtml(reportante?.correo)}</p>
      <p><strong>Teléfono:</strong> ${escaparHtml(reportante?.telefono)}</p>
      <p><strong>Ubicación:</strong> ${escaparHtml(ubicacion)}</p>
      <p><strong>Descripción:</strong> ${escaparHtml(averia.descripcion)}</p>
      <p><strong>Fecha:</strong> ${new Date(averia.fecha_reporte).toLocaleString('es-CO')}</p>`;

    await Promise.all(
      fontaneros.flatMap((f) => [
        enviarCorreo({
          to: f.correo,
          subject: 'Nueva avería reportada - Acueducto Campo Amor',
          html,
        }),
        notificar(f.id, `Nueva avería de ${nombre}, en ${ubicacion}. ${averia.descripcion}`, 'averia'),
      ])
    );
  } catch (err) {
    console.error('Error avisando al fontanero por correo:', err.message);
  }
}

// ---------- USUARIO FINAL ----------

// POST / - el usuario reporta una avería
async function reportarAveria(req, res) {
  try {
    const perfilId = req.usuario.id;
    const zonaUsuario = req.usuario.zona;
    const direccionUsuario = req.usuario.direccion;
    const { descripcion, ubicacionConfirmada, ubicacion } = req.body;

    if (typeof descripcion !== 'string' || descripcion.trim().length < 20) {
      return res.status(400).json({ error: 'Describe el problema con más detalle (mínimo 20 caracteres).' });
    }

    let zonaReporte = zonaUsuario;
    let direccionReporte = direccionUsuario;
    if (req.usuario.rol === 'administrador') {
      if (typeof ubicacion !== 'string' || !ubicacion.trim() || ubicacion.trim().length > 200) {
        return res.status(400).json({
          error: 'Indica la ubicación de la avería (máximo 200 caracteres).',
        });
      }
      zonaReporte = null;
      direccionReporte = ubicacion.trim();
    } else if (!zonaUsuario && !direccionUsuario) {
      return res.status(400).json({
        error: 'Tu cuenta no tiene una dirección registrada. Contacta al administrador del acueducto para registrarla antes de reportar.',
      });
    }
    if (ubicacionConfirmada !== true) {
      return res.status(400).json({ error: 'Debes confirmar que esa es la ubicación de la avería' });
    }

    const { data, error } = await breakdownModel.create(
      { perfil_id: perfilId, descripcion: descripcion.trim(), zona: zonaReporte, direccion: direccionReporte },
      req.db
    );

    if (error) return errorConsulta(res, error);

    // El reporte ya quedó guardado. Correo y aviso al fontanero son tareas
    // secundarias: no dejamos al usuario esperando ni convertimos un fallo de
    // correo en un falso error de reporte.
    void avisarFontaneroPorCorreo(data);

    res.status(201).json({ data });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// GET /mis-averias - averías reportadas por el usuario autenticado
async function misAverias(req, res) {
  try {
    const perfilId = req.usuario.id;

    const { data, error } = await breakdownModel.listByProfile(perfilId, req.db);

    if (error) return errorConsulta(res, error);

    res.status(200).json({ data });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// ---------- FONTANERO ----------

// GET / - el fontanero (único) ve TODAS las averías.
// La `zona` identifica la ubicación del beneficiario, no una zona de
// asignación, así que no se filtra por ella.
async function listarAverias(req, res) {
  try {
    const { estado, limit, offset } = req.query;

    const { data, error } = await breakdownModel.list({ estado, limit, offset });
    if (error) return errorConsulta(res, error);

    const ids = [...new Set((data || []).map((averia) => averia.perfil_id).filter(Boolean))];
    const { data: perfiles, error: perfilesError } = ids.length
      ? await supabaseAdmin.from('profiles')
          .select('id,nombre,apellido,correo,telefono,zona,direccion').in('id', ids)
      : { data: [], error: null };
    if (perfilesError) return errorConsulta(res, perfilesError);
    const porId = new Map((perfiles || []).map((perfil) => [perfil.id, perfil]));
    const conReportante = (data || []).map((averia) => ({
      ...averia,
      reportante: porId.get(averia.perfil_id) || null,
    }));

    res.status(200).json({ data: conReportante });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// PUT /:id - el fontanero actualiza el estado de una avería
async function actualizarAveria(req, res) {
  try {
    const fontaneroId = req.usuario.id;
    const { id } = req.params;
    const { estado, nota } = req.body;

    if (!estado || !ESTADOS_VALIDOS.includes(estado)) {
      return res.status(400).json({
        error: `Estado inválido. Usa: ${ESTADOS_VALIDOS.join(', ')}`,
      });
    }

    if (nota !== undefined && (typeof nota !== 'string' || nota.length > 1000)) {
      return res.status(400).json({ error: 'La nota debe tener máximo 1000 caracteres' });
    }
    if (estado === 'en_proceso') {
      const { data: activas, error: errorActivas } = await breakdownModel.list({
        estado: 'en_proceso',
      });
      if (errorActivas) return errorConsulta(res, errorActivas);

      const otraActiva = (activas || []).find((averia) => averia.id !== id);
      if (otraActiva) {
        return res.status(409).json({
          error: 'Termina la averia que esta en proceso antes de empezar otra.',
        });
      }
    }

    const actualizacion = { estado, fontanero_id: fontaneroId };
    if (nota !== undefined) actualizacion.nota_fontanero = nota.trim() || null;
    if (estado === 'resuelta') {
      actualizacion.fecha_resolucion = new Date().toISOString();
    }

    const { data, error } = await breakdownModel.update(id, actualizacion);

    if (error?.code === '23505') {
      return res.status(409).json({
        error: 'Termina la averia que esta en proceso antes de empezar otra.',
      });
    }
    if (error) return errorConsulta(res, error);
    if (!data) {
      return res.status(404).json({ error: 'Avería no encontrada' });
    }

    const resumenAveria = (data.descripcion || '').trim();
    const notaFontanero = (data.nota_fontanero || '').trim();
    const mensajes = {
      en_proceso: [
        'El fontanero tomó tu avería y la atenderá para resolverla en las próximas horas.',
        notaFontanero ? `Mensaje del fontanero: ${notaFontanero}` : null,
      ].filter(Boolean).join(' '),
      // La notificación conserva el contexto del reporte y la respuesta escrita
      // por el fontanero, para que el usuario la pueda leer desde la app.
      resuelta: [
        'Tu avería fue solucionada con éxito.',
        resumenAveria ? `Avería reportada: ${resumenAveria}` : null,
        notaFontanero ? `Mensaje del fontanero: ${notaFontanero}` : null,
      ].filter(Boolean).join(' '),
      reportada: [
        'El estado de tu avería cambió a reportada.',
        notaFontanero ? `Mensaje del fontanero: ${notaFontanero}` : null,
      ].filter(Boolean).join(' '),
      cancelada: [
        'Tu avería fue cancelada.',
        notaFontanero ? `Mensaje del fontanero: ${notaFontanero}` : null,
      ].filter(Boolean).join(' '),
    };
    const notificacionEnviada = await notificar(data.perfil_id, mensajes[estado], 'averia');

    res.status(200).json({ data, notificacionEnviada });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// DELETE /:id - el fontanero o el administrador borran un reporte
// erróneo o duplicado.
async function eliminarAveria(req, res) {
  try {
    const { id } = req.params;

    const { data, error } = await breakdownModel.remove(id);

    if (error || !data) {
      return res.status(404).json({ error: 'Avería no encontrada' });
    }

    res.status(200).json({ message: 'Avería eliminada', data });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

module.exports = { reportarAveria, misAverias, listarAverias, actualizarAveria, eliminarAveria };
