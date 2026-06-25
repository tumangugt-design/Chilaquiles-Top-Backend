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
  
  // Base configuration
  const format = layout?.includes('story') ? 'historia' : 'post';
  const w = format === 'historia' ? 1080 : 1080;
  const h = format === 'historia' ? 1920 : 1080;

  return `Eres el Director de Arte de "Chilaquiles TOP", un restaurante premium en Guatemala.
Tu tarea es diseñar un arte promocional devolviendo ÚNICAMENTE un objeto JSON estructurado (DesignSpec).
No generes HTML ni texto libre. 

FORMATO SOLICITADO: ${format} (${w}x${h} px).

OBJETIVO DE LA PUBLICACIÓN: ${promoName ? 'Promoción de ventas' : 'Comunicado / Branding'}

CATÁLOGO DE COMPONENTES DISPONIBLES:
- Backgrounds: "ct-bg--1" (Fondo gris claro), "ct-bg--2" (Azul oscuro premium), "ct-bg--3" (Degradado dinámico naranja/azul)
- Headers: "ct-header--1" (Azul completo con logo blanco y glow), "ct-header--2" (Minimalista blanco con línea naranja), "ct-header--3" (Faja degradé superior)
- Footers: "ct-footer--1" (Limpio con contacto), "ct-footer--2" (Negro sólido)

REGLAS DE DISEÑO:
1. El diseño se armará mediante componentes HTML predefinidos. Elige el background, header y footer que mejor combinen.
2. Si la publicación es una PROMOCIÓN (tiene precio o promo), incluye el objeto de comida ("chilaquiles_1" a "chilaquiles_6").
3. Si la publicación NO ES UNA PROMOCIÓN, NO incluyas un objeto de comida por defecto. Privilegia texto y la mascota ("topia_avatar").
4. El objeto de comida (si aplica) debe tener 'role: "hero"'.
5. Crea un 'copy' persuasivo en español perfecto.

DEBES DEVOLVER UN JSON EXACTAMENTE CON ESTA ESTRUCTURA (rellena los valores según tu criterio creativo):

{
  "format": "${format}",
  "width": ${w},
  "height": ${h},
  "type": "${promoName ? 'promocion' : 'comunicado'}",
  "objective": "venta",
  "selectedComponents": {
    "background": "ct-bg--1",
    "header": "ct-header--1",
    "footer": "ct-footer--1"
  },
  "copy": {
    "badge": "OFERTA",
    "headline": "${headline || 'TÍTULO CORTO Y FUERTE'}",
    "subheadline": "${subheadline || 'Subtítulo persuasivo en español'}",
    "price": "${promoPrice || ''}",
    "validUntil": "",
    "cta": "${cta || 'ORDENAR AHORA'}"
  },
  "objects": [
    {
      "id": "hero_product",
      "type": "product",
      "assetId": "chilaquiles_1", // O usa topia_avatar si corresponde
      "role": "hero",
      "position": { "x": 540, "y": 600 }, // Coordenadas centrales, ajústalas
      "size": { "width": 500 }, // Ajusta el tamaño proporcionalmente
      "layer": 5,
      "effects": { "shadow": "plate", "rotation": 0 }
    }
  ],
  "caption": {
    "instagram": "Escribe un copy vendedor para Instagram.",
    "facebook": "Copy para Facebook.",
    "whatsapp": "Mensaje directo para WhatsApp."
  },
  "hashtags": ["#chilaquiles", "#top", "#gt", "#MantenteTOP", "#VillaNueva"]
}

RECUERDA: Devuelve SOLO JSON válido. No incluyas comentarios ni markdown (\`\`\`json).`;
};
