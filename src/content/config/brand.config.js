// ============================================================
// BRAND ASSETS - Chilaquiles TOP
// Logos, mascota TopIA y assets oficiales de la marca.
// Estos assets siempre se componen sobre la imagen generada.
// ============================================================

// ⚠️ DATOS REALES DE CONTACTO — NO INVENTAR, SIEMPRE USAR ESTOS
export const BRAND_CONTACT = {
  whatsapp: '+502 3301 9938',
  whatsappClean: '50233019938', // Para links wa.me/
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
  // Logo principal - redondo con fondo azul (visible en cualquier fondo)
  logo: process.env.BRAND_LOGO_URL || 'https://raw.githubusercontent.com/tumangugt-design/Imagenes-chilaquiles/main/Logo/Redondo%20Fondo%20Azul.png',
  // Logo letras blancas (solo para fondos oscuros/azul)
  logoWhiteOnBlue: process.env.BRAND_LOGO_WHITE_URL || 'https://raw.githubusercontent.com/tumangugt-design/Imagenes-chilaquiles/main/Logo/Logo%20Letras%20Blancas.png',
  // Logo rectangular azul transparente (para fondos blancos)
  logoBlueTransparent: 'https://raw.githubusercontent.com/tumangugt-design/Imagenes-chilaquiles/main/Logo/Rectangular%20Letra%20Azul%20Transparente.png',
  // Mascota TopIA - Avatar principal
  topIA: process.env.BRAND_TOPIA_URL || 'https://raw.githubusercontent.com/tumangugt-design/Imagenes-chilaquiles/main/Personajes/TopIA/TopIA%20Avatar%20V1.png',
  // Platos reales sin fondo para composición
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
  // Núcleo
  blue: '#0000FF',
  white: '#FFFFFF',
  black: '#0B0B12',
  // Operativos
  orange: '#FF6B00',
  green: '#5DB662',
  lavender: '#E5E6FC',
  // Personaje / comida
  corn: '#F2B705',
  amber: '#D9851F',
  chocolate: '#502914',
  // Degradado oficial
  gradient: 'linear-gradient(90deg, #0000FF 0%, #FF6B00 100%)',
};

// IMPORTANT: No CSS syntax here — it bleeds into the AI-generated image
export const buildImagePrompt = (designSpec, promotionData) => {
  const { headline, subheadline, price, cta, layout, includeTopIA, includePlate } = designSpec || {};
  const promoName = promotionData?.name || '';
  const promoPrice = promotionData?.price ? `Q${promotionData.price}` : (price || '');
  // Map format to exact canvas and layout instructions
  const FORMAT_SPECS = {
    instagram_feed:     { w: 1080, h: 1080, label: 'Post cuadrado (1080×1080 px)',    layout: 'Diseño cuadrado balanceado. Logo arriba izquierda, headline grande al centro, precio visible, CTA naranja abajo.' },
    instagram_story:    { w: 1080, h: 1920, label: 'Historia vertical (1080×1920 px)', layout: 'Diseño VERTICAL como pantalla de teléfono (9:16). Logo y texto en la zona superior, elemento visual al centro, botón CTA grande en el tercio inferior. TODO el contenido debe estar DENTRO del área vertical, nada cortado.' },
    whatsapp_image:     { w: 1080, h: 1080, label: 'Imagen WhatsApp (1080×1080 px)',  layout: 'Diseño cuadrado con CTA muy grande y número de WhatsApp prominente.' },
    facebook_cover:     { w: 1640, h: 624,  label: 'Portada Facebook (1640×624 px)',  layout: 'Diseño HORIZONTAL apaisado (banner). Texto a la izquierda, imagen a la derecha. Muy amplio y panorámico.' },
    tiktok_video_cover: { w: 1080, h: 1920, label: 'Portada TikTok (1080×1920 px)',  layout: 'Diseño VERTICAL (9:16). Impactante, juvenil, con headline muy grande y llamativo.' },
  };
  const fmtSpec = FORMAT_SPECS[layout] || FORMAT_SPECS.instagram_feed;

  return `Eres un diseñador experto de marketing para la marca "Chilaquiles TOP", restaurante en Villa Nueva, Guatemala.

IDIOMA: Todo el texto del arte debe estar en ESPAÑOL CORRECTO. Sin abreviaciones, sin anglicismos innecesarios, sin faltas de ortografía. Revisa cada palabra antes de incluirla.

FORMATO DEL ARTE: ${fmtSpec.label}
DIMENSIONES EXACTAS: ${fmtSpec.w} × ${fmtSpec.h} píxeles. El arte DEBE llenar exactamente este espacio, sin cortes, sin bordes negros, sin contenido fuera del área.
COMPOSICIÓN: ${fmtSpec.layout}

COLORES OBLIGATORIOS DE LA MARCA:
- Azul puro (identidad principal): fondos fuertes, círculos de precio, elementos de marca
- Blanco: áreas de respiración, tarjetas, texto sobre azul
- Negro oscuro: texto principal sobre fondos blancos
- Naranja (acento, máximo 10%): ÚNICAMENTE para el botón de acción (CTA)
- Lavanda claro: fondos secundarios suaves
- Dorado/amarillo maíz: acento decorativo de comida
Regla de proporción: 60% azul o blanco · 30% contenido · 10% naranja

${topiaInstructions}

${plateInstructions}

LOGO: La última imagen de referencia es el logo oficial. Colócalo en la esquina superior izquierda. Usa exactamente ese logo sin modificarlo.

CONTENIDO DE LA PROMOCIÓN:
${promoName ? `- Nombre: ${promoName}` : ''}
${promoPrice ? `- Precio: ${promoPrice} — dentro de un círculo azul sólido, grande y bien legible` : ''}
${headline ? `- Titular principal: "${headline}"` : '- Crea un titular corto en español para esta promoción (máximo 4 palabras, en negritas)'}
${subheadline ? `- Texto secundario: "${subheadline}"` : ''}
- Botón de acción (naranja, forma de pastilla redondeada): "${cta || 'ORDENAR AHORA'}"
- WhatsApp para pedidos: ${BRAND_CONTACT.whatsapp}
- Hashtags pequeños al pie: ${BRAND_CONTACT.hashtags.join(' ')}

ESTÁNDARES DE CALIDAD:
- Diseño premium y profesional, como si lo hiciera una agencia de diseño reconocida.
- Jerarquía tipográfica clara: titular dominante, precio muy visible, CTA legible.
- Formas geométricas permitidas: círculos, rectángulos redondeados, líneas de acento.
- Línea delgada degradado azul→naranja como separador visual (uso moderado).
- Sin fondos de foto de stock. Usa colores sólidos o patrones geométricos sutiles.
- Sin códigos QR.
- Sin números de teléfono, URLs ni datos inventados.
- Sin texto técnico, sin código, sin términos en inglés innecesarios.
- El resultado debe sentirse tecnológico, limpio, vibrante y reconociblemente "Chilaquiles TOP".`;
};
