// ============================================================
// LIMITACION DE TASA
//
// No habia ninguna en todo el proyecto. Consecuencias concretas que esto
// cierra:
//  - POST /auth/send-otp es publico y cada llamada envia una plantilla de
//    WhatsApp Business, que cuesta dinero. Un bucle quema saldo en Q y puede
//    hacer que Meta suspenda el numero.
//  - verify-otp no tenia contador de intentos: el codigo es de 6 digitos y
//    vive 5 minutos, asi que unos miles de peticiones por segundo agotan el
//    espacio dentro de esa ventana.
//  - Los webhooks del bot llaman al LLM en cada mensaje: sin techo, se agota
//    el credito de OpenRouter y se cae la atencion al cliente real.
//
// Es en memoria, a proposito: sin dependencias nuevas y sin otra pieza de
// infraestructura. Limitacion honesta: Cloud Run puede correr varias
// instancias y cada una lleva su propio conteo, asi que el limite efectivo se
// multiplica por el numero de instancias. Aun asi corta el abuso automatizado,
// que es de donde viene el riesgo.
// ============================================================

const buckets = new Map();

// Limpieza periodica para que el Map no crezca sin fin.
const LIMPIEZA_MS = 10 * 60 * 1000;
setInterval(() => {
  const ahora = Date.now();
  for (const [clave, bucket] of buckets) {
    if (ahora > bucket.reinicia) buckets.delete(clave);
  }
}, LIMPIEZA_MS).unref?.();

/**
 * @param {object} opts
 * @param {number} opts.ventanaMs   ventana de tiempo
 * @param {number} opts.maximo      peticiones permitidas por clave en esa ventana
 * @param {string} opts.nombre      para el log
 * @param {function} [opts.clave]   como identificar al que pide (default: IP)
 */
export const rateLimit = ({ ventanaMs, maximo, nombre, clave }) => (req, res, next) => {
  const id = `${nombre}:${clave ? clave(req) : (req.ip || 'sin-ip')}`;
  const ahora = Date.now();

  let bucket = buckets.get(id);
  if (!bucket || ahora > bucket.reinicia) {
    bucket = { conteo: 0, reinicia: ahora + ventanaMs };
    buckets.set(id, bucket);
  }

  bucket.conteo += 1;

  if (bucket.conteo > maximo) {
    const segundos = Math.ceil((bucket.reinicia - ahora) / 1000);
    console.warn(`[RateLimit] ${nombre} bloqueado para ${id} (${bucket.conteo} en la ventana)`);
    res.set('Retry-After', String(segundos));
    return res.status(429).json({
      message: `Demasiados intentos. Volvé a probar en ${segundos} segundos.`
    });
  }

  return next();
};

/** Por telefono, no por IP: un atacante rota IPs pero apunta al mismo numero. */
export const porTelefono = (req) =>
  String(req.body?.phone || req.body?.telefono || req.ip || 'sin-telefono').trim();
