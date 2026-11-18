const scheduledOutageModel = require('../models/scheduledOutageModel');
const profileModel = require('../models/profileModel');
const notificationModel = require('../models/notificationModel');
const { enviarAvisosCorreo } = require('../services/avisosCorreo');
const { registrarAuditoria } = require('../utils/auditoria');
const { fechaHoraColombia } = require('../utils/fechas');
const { errorInesperado, errorConsulta } = require('../utils/httpErrores');

// Cortes programados: el administrador anuncia una suspensión (mantenimiento,
// daño general) para una zona o para todo el acueducto. Los usuarios de esa
// zona reciben el aviso en la app (y por correo si se pide) y lo ven en
// "Estado del servicio" hasta que termina.

const MAX_DIAS_ANTICIPACION = 60;

function textoAviso({ zona, motivo, inicio, fin }) {
  const donde = zona ? `en la zona ${zona}` : 'en todo el acueducto';
  return `Corte de agua programado ${donde}: desde el ${fechaHoraColombia(inicio)} hasta el ${fechaHoraColombia(fin)}. Motivo: ${motivo}. Te recomendamos almacenar agua.`;
}

// GET /api/cortes/programados - el usuario ve los de su zona y los generales.
async function misCortesProgramados(req, res) {
  try {
    const { data, error } = await scheduledOutageModel.listUpcomingForZone(
      req.usuario.zona,
      new Date().toISOString(),
    );
    if (error) return errorConsulta(res, error);
    return res.status(200).json(data || []);
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// GET /api/cortes/programados/todos?terminados=true - administrador.
async function listarCortesProgramados(req, res) {
  try {
    const { data, error } = await scheduledOutageModel.list({
      incluirTerminados: req.query.terminados === 'true',
    });
    if (error) return errorConsulta(res, error);
    return res.status(200).json(data || []);
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// GET /api/cortes/zonas - zonas registradas, para elegir a quién avisar.
async function listarZonas(req, res) {
  try {
    const { data, error } = await profileModel.listZones();
    if (error) return errorConsulta(res, error);
    return res.status(200).json(data);
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// POST /api/cortes/programados - { zona?, motivo, inicio, fin, enviar_correo? }
async function crearCorteProgramado(req, res) {
  const zona = typeof req.body.zona === 'string' && req.body.zona.trim() ? req.body.zona.trim() : null;
  const motivo = typeof req.body.motivo === 'string' ? req.body.motivo.trim() : '';
  const inicio = new Date(req.body.inicio);
  const fin = new Date(req.body.fin);
  const enviarCorreo = req.body.enviar_correo === true;

  if (motivo.length < 5 || motivo.length > 300) {
    return res.status(400).json({ error: 'Describe el motivo del corte (entre 5 y 300 caracteres).' });
  }
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) {
    return res.status(400).json({ error: 'Indica la fecha y hora de inicio y de fin del corte.' });
  }
  if (fin <= inicio) {
    return res.status(400).json({ error: 'La hora de fin debe ser posterior a la de inicio.' });
  }
  if (fin <= new Date()) {
    return res.status(400).json({ error: 'El corte ya terminó; no tiene sentido anunciarlo.' });
  }
  if (inicio.getTime() - Date.now() > MAX_DIAS_ANTICIPACION * 24 * 60 * 60 * 1000) {
    return res.status(400).json({ error: `Solo se pueden anunciar cortes con máximo ${MAX_DIAS_ANTICIPACION} días de anticipación.` });
  }

  try {
    const { data: corte, error } = await scheduledOutageModel.create({
      zona,
      motivo,
      inicio: inicio.toISOString(),
      fin: fin.toISOString(),
      creado_por: req.usuario.id,
    });
    if (error) return errorConsulta(res, error);

    const { data: perfiles, error: errorPerfiles } = await profileModel.listActiveByZone(zona);
    if (errorPerfiles) return errorConsulta(res, errorPerfiles);

    const mensaje = textoAviso(corte);
    let usuariosNotificados = 0;
    if (perfiles?.length) {
      const { error: errorAvisos } = await notificationModel.createMany(
        perfiles.map((p) => p.id),
        { mensaje, tipo: 'corte' },
      );
      if (errorAvisos) console.error('[cortes-programados] avisos no creados:', errorAvisos.message);
      else usuariosNotificados = perfiles.length;
    }

    const correos = enviarCorreo && perfiles?.length
      ? await enviarAvisosCorreo(perfiles, mensaje)
      : null;

    await registrarAuditoria({
      adminId: req.usuario.id,
      accion: 'corte_programado_creado',
      tabla: 'cortes_programados',
      registroId: corte.id,
      detalle: { zona, inicio: corte.inicio, fin: corte.fin, usuariosNotificados },
    });

    return res.status(201).json({
      message: `Corte anunciado a ${usuariosNotificados} usuario(s)${zona ? ` de la zona ${zona}` : ''}.`,
      corte,
      usuarios_notificados: usuariosNotificados,
      ...(correos ? { correos_enviados: correos.enviados, correos_fallidos: correos.fallidos } : {}),
    });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

// PUT /api/cortes/programados/:id/cancelar - avisa que ya no habrá corte.
async function cancelarCorteProgramado(req, res) {
  try {
    const { data: corte, error } = await scheduledOutageModel.cancel(req.params.id);
    if (error) return errorConsulta(res, error);
    if (!corte) return res.status(404).json({ error: 'Corte no encontrado o ya cancelado.' });

    const { data: perfiles } = await profileModel.listActiveByZone(corte.zona);
    if (perfiles?.length && new Date(corte.fin) > new Date()) {
      await notificationModel.createMany(perfiles.map((p) => p.id), {
        mensaje: `Se canceló el corte de agua programado para el ${fechaHoraColombia(corte.inicio)}. El servicio sigue normal.`,
        tipo: 'corte',
      });
    }

    await registrarAuditoria({
      adminId: req.usuario.id,
      accion: 'corte_programado_cancelado',
      tabla: 'cortes_programados',
      registroId: corte.id,
      detalle: { zona: corte.zona, inicio: corte.inicio },
    });

    return res.status(200).json({ message: 'Corte programado cancelado y usuarios avisados.', corte });
  } catch (err) {
    return errorInesperado(res, err);
  }
}

module.exports = {
  textoAviso,
  misCortesProgramados,
  listarCortesProgramados,
  listarZonas,
  crearCorteProgramado,
  cancelarCorteProgramado,
};
