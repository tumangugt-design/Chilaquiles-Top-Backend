import crypto from 'crypto';

// ============================================================
// ENDPOINTS DISPARADOS POR CLOUD SCHEDULER
//
// /bot/cron-survey y /content/scheduler/run estaban abiertos al internet: sin
// firma, sin token, sin cabecera de Cloud Scheduler. Cualquiera podia forzar
// el envio de encuestas antes de tiempo (le llegaban al cliente antes que la
// comida) o publicar contenido programado fuera de fecha — logica de negocio
// con costo real en Q, ejecutable por un extrano y sin registro de quien fue.
//
// Se pide un token compartido en la cabecera X-Cron-Token, comparado con
// timingSafeEqual. Cloud Scheduler lo manda como header personalizado.
// ============================================================

export const verifyCronToken = (req, res, next) => {
  const esperado = process.env.CRON_SECRET_TOKEN;

  if (!esperado) {
    console.error('[Cron] Falta CRON_SECRET_TOKEN. El endpoint queda cerrado hasta configurarlo.');
    return res.status(503).json({ message: 'Cron no configurado en el servidor.' });
  }

  const recibido = String(req.headers['x-cron-token'] || req.query.token || '');
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);

  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    console.warn(`[Cron] Intento con token invalido desde ${req.ip}`);
    return res.status(401).json({ message: 'No autorizado.' });
  }

  return next();
};
