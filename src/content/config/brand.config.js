// ============================================================
// BRAND ASSETS - Chilaquiles TOP
// Logos, mascota TopIA y assets oficiales de la marca.
// ============================================================

export const BRAND_CONTACT = {
  whatsapp: '+502 3301-9938',
  whatsappClean: '50233019938',
  whatsappLink: 'https://wa.me/50233019938',
  orderUrl: 'https://pedidos.chilaquilestop.com/clientes',
  landingUrl: 'https://chilaquilestop.com',
  location: 'Villa Nueva, Guatemala',
  deliveryArea: 'Solo entregamos en Villa Nueva',
  instagram: '@Chilaquiles_Top',
  instagramUrl: 'https://instagram.com/Chilaquiles_Top',
  hashtags: ['#chilaquiles', '#top', '#gt', '#MantenteTOP', '#VillaNueva'],
};

export const BRAND_ASSETS = {
  logo: process.env.BRAND_LOGO_URL || 'https://raw.githubusercontent.com/tumangugt-design/Imagenes-chilaquiles/main/Logo/Redondo%20Fondo%20Azul.png',
  logoWhiteOnBlue: process.env.BRAND_LOGO_WHITE_URL || 'https://raw.githubusercontent.com/tumangugt-design/Imagenes-chilaquiles/main/Logo/Logo%20Letras%20Blancas.png',
  logoBlueTransparent: 'https://raw.githubusercontent.com/tumangugt-design/Imagenes-chilaquiles/main/Logo/Rectangular%20Letra%20Azul%20Transparente.png',
  topIA: process.env.BRAND_TOPIA_URL || 'https://raw.githubusercontent.com/tumangugt-design/Imagenes-chilaquiles/main/Personajes/TopIA/TopIA%20Avatar%20V1.png',
  plates: [
    'https://raw.githubusercontent.com/tumangugt-design/Imagenes-chilaquiles/main/Fotos%20de%20Platos%20Reales%20Sin%20Fondo/Plato%201.png',
    'https://raw.githubusercontent.com/tumangugt-design/Imagenes-chilaquiles/main/Fotos%20de%20Platos%20Reales%20Sin%20Fondo/Plato%202.png',
    'https://raw.githubusercontent.com/tumangugt-design/Imagenes-chilaquiles/main/Fotos%20de%20Platos%20Reales%20Sin%20Fondo/Plato%203.png',
    'https://raw.githubusercontent.com/tumangugt-design/Imagenes-chilaquiles/main/Fotos%20de%20Platos%20Reales%20Sin%20Fondo/Plato%204.png',
    'https://raw.githubusercontent.com/tumangugt-design/Imagenes-chilaquiles/main/Fotos%20de%20Platos%20Reales%20Sin%20Fondo/Plato%205.png',
    'https://raw.githubusercontent.com/tumangugt-design/Imagenes-chilaquiles/main/Fotos%20de%20Platos%20Reales%20Sin%20Fondo/Plato%206.png'
  ]
};

export const BRAND_COLORS = {
  blue: '#0000FF',
  white: '#FFFFFF',
  black: '#0B0B12',
  orange: '#FF6B00',
  green: '#25D366',
  lavender: '#E5E6FC',
};

/**
 * buildDesignSpecPrompt — instruye a la IA para devolver un DesignSpec JSON limpio.
 *
 * @param {object} requestData  — datos del Admin: topic, format, promotionData, includeTopIA, includePlate
 */
export const buildDesignSpecPrompt = (requestData = {}) => {
  const { topic, format, promotionData, includeTopIA, includePlate } = requestData;

  const isPromo = !!promotionData;
  const isHistoria = format === 'historia';
  const w = 1080;
  const h = isHistoria ? 1920 : 1080;

  // Calcular fecha de validez legible
  let validUntilStr = '';
  if (isPromo && promotionData.endDate) {
    const d = new Date(promotionData.endDate);
    validUntilStr = d.toLocaleDateString('es-GT', { day: 'numeric', month: 'long' });
  }

  const promoBlock = isPromo ? `
PROMOCIÓN ACTIVA:
- Nombre: "${promotionData.name}"
- Descripción: "${promotionData.description || ''}"
- Precio: "Q${promotionData.price}"
${validUntilStr ? `- Válido hasta: "${validUntilStr}"` : ''}
` : '';

  const topiaBlock = includeTopIA ? `- INCLUIR mascota TopIA: assetId = "topia_avatar"` : `- NO incluir mascota TopIA`;
  const plateBlock = includePlate ? `- INCLUIR foto real de plato (role "hero"): escoge entre chilaquiles_1 a chilaquiles_6` : `- NO incluir foto de plato, a menos que sea una promoción`;

  return `Eres el Director de Arte de "Chilaquiles TOP", un restaurante premium en Villa Nueva, Guatemala.

Tu única tarea es devolver un JSON con el DesignSpec para armar un arte de marketing.
El sistema leerá tu JSON y ensamblará los componentes HTML reales del sistema.

INSTRUCCIÓN DEL ADMIN: "${topic || (isPromo ? 'Promoción de ventas' : 'Publicación de marca')}"
FORMATO: ${isHistoria ? 'historia' : 'post'} (${w}x${h}px)
${promoBlock}
OPCIONES VISUALES:
${topiaBlock}
${plateBlock}

COMPONENTES HTML DISPONIBLES (escoge los que mejor combinen):
Backgrounds:
  - "ct-bg--1" → Campo de puntos lavanda, fondo blanco/claro. Versátil. Para: cualquier tipo de publicación.
  - "ct-bg--3" → Panel diagonal azul/blanco. Para: promos dinámicas, comunicados vibrantes.
  NOTA: SIEMPRE usa ct-bg--1 o ct-bg--3. NUNCA uses ct-bg--2 (reservado para uso futuro).
Headers:
  - "ct-header--1" → Azul sólido con logo blanco + badge naranja. USAR SIEMPRE en promociones.
  - "ct-header--2" → Blanco minimalista, logo azul + badge naranja. Para: comunicados, educativo.
  - "ct-header--3" → Faja naranja→azul, logo azul centrado. Para: comunicados, educativo.
Footers:
  - "ct-footer--1" → Azul sólido, texto blanco. Combina con ct-header--1.
  - "ct-footer--3" → Blanco borde naranja. Combina con ct-header--2 y ct-header--3.

REGLAS DE DISEÑO:
1. FONDO: Siempre usa ct-bg--1 o ct-bg--3. NUNCA ct-bg--2.
2. HEADER para PROMOCIÓN: SIEMPRE usa ct-header--1 (azul con logo blanco). FOOTER: ct-footer--1.
3. HEADER para OTRO TEMA: elige entre ct-header--2 o ct-header--3. FOOTER: ct-footer--3.
4. BADGE: Los headers 1 y 2 ya incluyen el badge — deja el campo badge vacío ("") al usarlos. Solo pon texto en badge si usas ct-header--3.
5. PROMO: precio en campo price (ej: "Q55"), badge vacío si usas header--1 o header--2.
6. COPY: ESPAÑOL correcto, antojable, persuasivo. Headline corto y poderoso. Usa "bodyText" ÚNICAMENTE para comunicados largos o instrucciones (Ej. "Otro tema"). NUNCA uses "bodyText" para Promociones.
7. CTA: siempre "PIDE POR WHATSAPP" para promos.
8. IMPORTANTE: Devuelve SOLO JSON puro. Cero texto, cero comentarios, cero markdown.

ESTRUCTURA EXACTA A DEVOLVER (no pongas ningún comentario, no pongas // ni /* */):
{
  "format": "${isHistoria ? 'historia' : 'post'}",
  "width": ${w},
  "height": ${h},
  "type": "${isPromo ? 'promocion' : 'comunicado'}",
  "selectedComponents": {
    "background": "ct-bg--1",
    "header": "ct-header--1",
    "footer": "ct-footer--1"
  },
  "copy": {
    "badge": "OFERTA LIMITADA",
    "headline": "TEXTO PRINCIPAL CORTO",
    "subheadline": "Texto secundario descriptivo",
    "bodyText": "SOLO para temas informativos largos o instrucciones. Vacío para Promociones.",
    "price": "${isPromo ? ('Q' + (promotionData?.price || '00')) : ''}",
    "validUntil": "",
    "cta": "PIDE POR WHATSAPP",
    "validUntil": "${validUntilStr}"
  },
  "objects": [],
  "caption": {
    "instagram": "Caption persuasivo para Instagram con emojis y hashtags",
    "facebook": "Copy para Facebook",
    "whatsapp": "Mensaje directo para WhatsApp"
  },
  "hashtags": ["#ChilaquilesTop", "#MantenteTOP", "#VillaNueva", "#Guatemala"]
}

Si incluyes un objeto de imagen en "objects", usa este formato exacto para cada uno:
{"id": "hero_product", "type": "product", "assetId": "chilaquiles_1", "role": "hero", "size": {"width": 420}, "effects": {"shadow": "plate"}}`;
};
