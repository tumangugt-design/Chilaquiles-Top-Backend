import crypto from 'crypto';

// ============================================================
// FIRMA DE WEBHOOKS DE META
//
// Meta firma cada webhook con HMAC-SHA256 del cuerpo CRUDO usando el App
// Secret de la app dueña de la suscripcion. Sin esta verificacion, cualquiera
// puede mandar un POST inventando el remitente.
//
// Por que acepta MAS DE UN secreto: el negocio tiene dos identidades de app en
// Meta — la app padre ("Chilaquiles bot") y la identidad anidada de Instagram
// Login. Los webhooks de Instagram pueden venir firmados con el secreto de la
// segunda. El 28 de junio de 2026 se quito la verificacion del webhook de
// Instagram (commit 6d92ad2) en vez de resolver esto, y el endpoint quedo
// abierto dos meses y medio: cualquiera podia escribirle al bot haciendose
// pasar por el cliente que quisiera.
//
// Se prueba contra cada secreto configurado. Si ninguno cuadra, se rechaza.
// ============================================================

const secretosConfigurados = () =>
  [
    ['META_APP_SECRET', process.env.META_APP_SECRET],
    ['IG_APP_SECRET', process.env.IG_APP_SECRET],
    ['APP_SECRET', process.env.APP_SECRET],
  ].filter(([, valor]) => Boolean(valor));

const firmaCuadra = (rawBody, firmaRecibida, secreto) => {
  const esperada = `sha256=${crypto.createHmac('sha256', secreto).update(rawBody).digest('hex')}`;
  const a = Buffer.from(firmaRecibida);
  const b = Buffer.from(esperada);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

export const verifyMetaSignature = (req, res, next) => {
  const signature = req.headers['x-hub-signature-256'];

  if (!signature) {
    console.error('[Security] Webhook sin cabecera X-Hub-Signature-256. Rechazado.');
    return res.status(401).send('Unauthorized: Missing signature');
  }

  const secretos = secretosConfigurados();
  if (secretos.length === 0) {
    console.error('[Security] No hay ningun App Secret configurado (META_APP_SECRET / IG_APP_SECRET).');
    return res.status(500).send('Server configuration error');
  }

  if (!req.rawBody) {
    console.error('[Security] Falta req.rawBody. Revisar el verify de express.json en configs/server.js.');
    return res.status(500).send('Server configuration error');
  }

  for (const [nombre, secreto] of secretos) {
    try {
      if (firmaCuadra(req.rawBody, signature, secreto)) {
        req.metaSecretUsed = nombre;
        return next();
      }
    } catch {
      // secreto invalido o firma con formato raro: se sigue con el siguiente
    }
  }

  // El log dice QUE secretos se probaron (no su valor): si el bot de Instagram
  // deja de responder tras un despliegue, este mensaje es el diagnostico —
  // significa que falta IG_APP_SECRET, no que el webhook este mal.
  console.error(
    `[Security] Firma de webhook invalida. Se probaron: ${secretos.map(([n]) => n).join(', ')}. ` +
    'Si esto aparece para Instagram, falta configurar IG_APP_SECRET con el App Secret de la identidad de Instagram Login.'
  );
  return res.status(401).send('Unauthorized: Invalid signature');
};
