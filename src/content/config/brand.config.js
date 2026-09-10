// ============================================================
// FUENTE ÚNICA DE MARCA — Chilaquiles TOP
//
// Todo dato de marca que aparezca en un arte, un caption, un
// mensaje del bot o un envío de WhatsApp sale de aquí. Si un
// servicio vuelve a escribir el número de WhatsApp o el CTA a
// mano, es un bug: se corrige importando este archivo.
//
// La app manda sobre los documentos: los tokens de color y las
// tipografías de abajo son los mismos que carga el frontend
// (src/index.css e index.html). Si cambian allá, cambian aquí.
// ============================================================

export const BRAND_CONTACT = {
  whatsapp: '+502 3301-9938',
  whatsappClean: '50233019938',
  whatsappLink: 'https://wa.me/50233019938',

  // Regla de CTA por canal. En un post de Instagram nadie puede hacer clic:
  // el dominio se lee y se teclea, así que ahí gana el corto y memorable.
  // Donde el enlace sí es clicable, se usa el profundo y se ahorra un tap.
  ctaPrinted: 'chilaquilestop.com',                          // artes, piezas impresas
  ctaLink: 'https://pedidos.chilaquilestop.com/clientes',     // WhatsApp, bio, stickers
  landingUrl: 'https://chilaquilestop.com',

  location: 'Villa Nueva, Guatemala',
  deliveryArea: 'Solo entregamos en Villa Nueva',
  instagram: '@Chilaquiles_Top',
  instagramUrl: 'https://instagram.com/Chilaquiles_Top',
  tiktok: '@chilaquiles.top',
  email: 'contacto@chilaquilestop.com',
  hashtags: ['#ChilaquilesTop', '#MantenteTOP', '#VillaNueva', '#Guatemala'],
  tagline: '#MantenteTOP',
};

export const BRAND_ASSETS = {
  logo: process.env.BRAND_LOGO_URL || 'https://raw.githubusercontent.com/tumangugt-design/Imagenes-chilaquiles/main/Logo/Redondo%20Fondo%20Azul.png',
  logoWhiteOnBlue: process.env.BRAND_LOGO_WHITE_URL || 'https://raw.githubusercontent.com/tumangugt-design/Imagenes-chilaquiles/main/Logo/Logo%20Letras%20Blancas.png',
  logoBlueTransparent: 'https://raw.githubusercontent.com/tumangugt-design/Imagenes-chilaquiles/main/Logo/Rectangular%20Letra%20Azul%20Transparente.png',
  topIA: process.env.BRAND_TOPIA_URL || 'https://raw.githubusercontent.com/tumangugt-design/Imagenes-chilaquiles/main/Personajes/TopIA/TopIA%20Avatar%20V1.png',
};

// Tokens tomados del frontend (src/index.css). No inventar valores aquí.
export const BRAND_COLORS = {
  blue: '#0000FF',    // --color-brand-blue · primario, precios, identidad
  orange: '#FF6B00',  // --color-brand-orange · acento, badges, una sola acción
  red: '#D90429',     // --color-brand-red · alertas
  white: '#FFFFFF',
  ink: '#0F172A',     // --color-ui-text
  muted: '#64748B',   // --color-ui-muted
  border: '#E2E8F0',  // --color-ui-border
  ground: '#F8FAFC',  // --color-ui-bg
};

// Mismas familias que carga index.html del frontend.
export const BRAND_TYPE = {
  display: "'Montserrat', 'Futura', 'Gotham', sans-serif",
  body: "'Inter', -apple-system, 'Segoe UI', sans-serif",
  googleFontsHref: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800;900&family=Inter:wght@400;500;600;700;800;900&display=block',
};

/**
 * Bloque de contexto de marca que se inyecta en TODA generación —
 * copy y arte por igual. Antes cada servicio repetía dos o tres
 * líneas distintas de contexto y el arte no recibía ninguna.
 */
export const buildBrandContext = () => `IDENTIDAD
Chilaquiles TOP. No somos un restaurante que usa tecnología: somos una empresa
de software e inteligencia artificial cuyo producto son los mejores chilaquiles
de Guatemala. Posicionamiento: los primeros y mejores chilaquiles de Guatemala.

VOZ
Cercana, enérgica y directa. Español de Guatemala. Frases cortas, con ritmo.
Segura sin ser arrogante, cálida sin perder filo, tecnológica sin volverse fría.
A los clientes les decimos "nuestra gente TOP".

CÓMO ESCRIBIMOS
- Frases cortas y con energía. Nunca párrafos corporativos.
- Honestidad operativa: decimos la verdad sobre disponibilidad y temperatura.
- Un solo CTA por pieza. Nunca dos llamados compitiendo.
- Orgullo de marca, nunca comparaciones hacia abajo ni ataques a terceros.
- Emojis con medida en redes. Cero emojis en interfaces y documentos.

DATOS DUROS (nunca inventar otros)
- Cobertura: ${BRAND_CONTACT.deliveryArea}.
- WhatsApp: ${BRAND_CONTACT.whatsapp}
- CTA impreso en artes: ${BRAND_CONTACT.ctaPrinted}
- Instagram: ${BRAND_CONTACT.instagram}
- Cierre de marca: ${BRAND_CONTACT.tagline}

"FRÍO PARA CALENTAR"
El último paso de la cocción ocurre en casa del cliente para que el queso se
derrita y el totopo quede crujiente en el momento exacto de comer. Es una
decisión de producto y una ventaja de frescura — nunca se comunica como
limitación ni como disculpa.

PROHIBIDO
- Inventar ingredientes, precios, descuentos, horarios o vigencias.
- Prometer lo que la operación no sostiene.
- Anglicismos.`;

// ------------------------------------------------------------
// Normalizador de formato. Existe porque 'feed' se interpretaba
// distinto en tres servicios: el de copy lo trataba como post, el
// de arte como historia, y el render lo dibujaba a 1080x1080. Un
// template de 1920 de alto terminaba recortado a la mitad.
// Ahora hay un solo lugar que decide.
// ------------------------------------------------------------
const POST_ALIASES = ['post', 'feed', 'instagram_feed', 'reel', 'whatsapp_image', 'facebook_cover'];
const STORY_ALIASES = ['historia', 'story', 'instagram_story'];

/** Devuelve siempre 'post' o 'historia'. Cualquier alias desconocido cae en 'post'. */
export const normalizeFormat = (format, formats = []) => {
  const raw = String(format || formats?.[0] || 'post').trim().toLowerCase();
  if (STORY_ALIASES.includes(raw)) return 'historia';
  if (POST_ALIASES.includes(raw)) return 'post';
  return 'post';
};

/** Lienzo real del formato ya normalizado. Una sola fuente para template y render. */
export const getCanvas = (normalized) =>
  normalized === 'historia' ? { width: 1080, height: 1920 } : { width: 1080, height: 1080 };

// ------------------------------------------------------------
// Red de seguridad del titular.
//
// El modelo escoge la clase de tamano, pero se equivoca seguido y
// .canvas tiene overflow:hidden: un titular muy grande empuja el CTA
// y el pie fuera del lienzo y se pierden sin que nadie se entere.
// Esto recalcula la clase a partir del largo real del texto y la
// corrige en el HTML ya generado. Determinista, no opinable.
// ------------------------------------------------------------
const HEADLINE_STEPS = {
  post:         [[20, 'xl'], [45, 'lg'], [80, 'md'], [Infinity, 'sm']],
  storyTexto:   [[15, 'xl'], [35, 'lg'], [60, 'md'], [Infinity, 'sm']],
  storyPromo:   [[15, 'xl'], [30, 'lg'], [Infinity, 'md']],
};

/** Largo visible del titular: sin etiquetas, y <br> cuenta como un espacio. */
export const headlineLength = (raw = '') =>
  String(raw).replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').trim().length;

export const pickHeadlineSize = (raw, scale = 'post') => {
  const len = headlineLength(raw);
  const steps = HEADLINE_STEPS[scale] || HEADLINE_STEPS.post;
  return steps.find(([max]) => len < max)[1];
};

/**
 * Corrige la clase de tamano del titular en el HTML que devolvio la IA.
 * Soporta los dos prefijos que existen: .headline--* (post-promo) y
 * .ct-hl--* (los otros tres templates).
 */
const STEP_DOWN = { xl: 'lg', lg: 'md', md: 'sm', sm: 'sm' };

export const enforceHeadlineSize = (html, format = 'post', hasPlate = false) => {
  const scale = format === 'historia' ? (hasPlate ? 'storyPromo' : 'storyTexto') : 'post';
  // Si la pieza ademas lleva nombre de producto, el titular baja un escalon:
  // el tamano maximo solo cabe cuando el titular esta solo. Sin esto, el pie
  // se sale del lienzo y el arte se ve amontonado.
  const crowded = /class="[^"]*\bproduct-name\b/.test(html);

  return String(html).replace(
    /<div class="([^"]*)"([^>]*)>([\s\S]*?)<\/div>/g,
    (full, cls, attrs, inner) => {
      const tokens = cls.split(/\s+/).filter(Boolean);
      const base = tokens.includes('ct-hl') ? 'ct-hl' : tokens.includes('headline') ? 'headline' : null;
      if (!base) return full;

      let size = pickHeadlineSize(inner, scale);
      if (crowded) size = STEP_DOWN[size] || size;
      const kept = tokens.filter((t) => !t.startsWith(`${base}--`) && t !== base);
      const next = [...kept, base, `${base}--${size}`].join(' ');
      return `<div class="${next}"${attrs}>${inner}</div>`;
    }
  );
};

// ------------------------------------------------------------
// CTA: color e icono se derivan del destino, nunca se eligen a mano.
// Un boton verde de WhatsApp que manda a la web es la incoherencia
// que teniamos: el color prometia chat y el texto llevaba a un sitio.
// ------------------------------------------------------------
const ICON_WEB = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9.5"/><path d="M2.5 12h19M12 2.5c2.6 2.8 3.9 6 3.9 9.5S14.6 18.7 12 21.5c-2.6-2.8-3.9-6-3.9-9.5S9.4 5.3 12 2.5z"/></svg>';
const ICON_WA = '<svg width="32" height="32" viewBox="0 0 32 32" fill="#fff"><path d="M16 .4C7.4.4.5 7.3.5 15.9c0 2.8.7 5.4 2 7.8L.4 31.6l8.1-2.1c2.3 1.2 4.8 1.9 7.5 1.9 8.6 0 15.5-7 15.5-15.5C31.5 7.3 24.6.4 16 .4zm7.1 18.9c-.4-.2-2.3-1.1-2.6-1.3-.3-.1-.6-.2-.9.2-.3.4-1 1.3-1.2 1.5-.2.2-.4.3-.8.1-.4-.2-1.6-.6-3.1-1.9-1.1-1-1.9-2.3-2.2-2.7-.2-.4 0-.6.2-.8.2-.2.4-.4.5-.7.2-.2.2-.4.4-.7.1-.3.1-.5 0-.7-.1-.2-.9-2.2-1.3-3-.3-.8-.7-.7-.9-.7h-.8c-.3 0-.7.1-1.1.5-.4.4-1.4 1.4-1.4 3.4s1.5 3.9 1.7 4.2c.2.3 2.9 4.5 7.1 6.3 1 .4 1.8.7 2.4.9 1 .3 1.9.3 2.6.2.8-.1 2.3-1 2.7-1.9.3-.9.3-1.7.2-1.9-.1-.2-.4-.3-.8-.5z"/></svg>';

/** 'web' (por defecto) o 'whatsapp'. Devuelve texto, color e icono coherentes. */
export const buildCta = (kind = 'web') =>
  kind === 'whatsapp'
    ? { text: 'ESCRÍBENOS POR WHATSAPP', color: '#25D366', icon: ICON_WA }
    : { text: `PIDE EN ${BRAND_CONTACT.ctaPrinted.toUpperCase()}`, color: BRAND_COLORS.blue, icon: ICON_WEB };

// ------------------------------------------------------------
// Cromo determinista de la pieza.
//
// El modelo escribe lo creativo (titular, nombre, badge, caption).
// Todo lo que debe ser SIEMPRE igual — pie, precio, vigencia — lo
// arma el codigo. Menos margen al modelo, mas consistencia, y un
// agente puede generar piezas sin supervisar el detalle.
// ------------------------------------------------------------
const ICON_CAL_W = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
const ICON_IG_W = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1.2" fill="#fff"/></svg>';
const ICON_GLOBE_W = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';

/**
 * Tercera ranura del pie. Hay vigencia -> va la vigencia; no hay -> va el
 * dominio, para que la barra nunca quede coja en comunicados o frases.
 */
export const buildFooterRight = (validUntil = '') => {
  const d = String(validUntil || '').trim();
  // Sin vigencia va Instagram, NO el dominio: el dominio ya es el CTA y
  // repetirlo en la misma pieza es justo la redundancia que queriamos quitar.
  return d
    ? `<div class="fi">${ICON_CAL_W}Válido hasta el ${d}</div>`
    : `<div class="fi">${ICON_IG_W}${BRAND_CONTACT.instagram}</div>`;
};

/** Ranura inferior de las historias (no tienen barra de pie). */
export const buildBottomRight = (validUntil = '') =>
  String(validUntil || '').trim() ? BRAND_CONTACT.instagram : BRAND_CONTACT.instagram;

/**
 * Quita del HTML ya generado los bloques cuyo dato no existe: precio sin
 * precio, nombre vacio, variables que el modelo no sustituyo. Antes esto
 * dependia de que el modelo "borrara el div", y no siempre lo hacia.
 */
const OPTIONAL_SLOTS = ['price-badge', 'date-pill', 'product-name', 'product-desc', 'hbadge', 'badge'];

export const cleanUnfilledSlots = (html) =>
  OPTIONAL_SLOTS.reduce((acc, slot) => {
    const re = new RegExp(`\\s*<div class="[^"]*\\b${slot}\\b[^"]*"[^>]*>([\\s\\S]*?)</div>`, 'g');
    return acc.replace(re, (full, inner) => {
      const text = inner.replace(/<[^>]*>/g, '').replace(/\{\{[^}]*\}\}/g, '').trim();
      // "Q" suelto = precio que quedo sin numero
      return text === '' || text === 'Q' ? '' : full;
    });
  }, String(html));
