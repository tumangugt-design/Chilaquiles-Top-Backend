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
  orderUrl: 'https://chilaquiles-top.web.app/order',
  landingUrl: 'https://chilaquiles-top.web.app',
  location: 'Villa Nueva, Guatemala',
  deliveryArea: 'Solo entregamos en Villa Nueva',
  instagram: '@chilaquilestop',
  hashtags: ['#chilaquiles', '#top', '#gt', '#MantenteTOP', '#VillaNueva'],
};

export const BRAND_ASSETS = {
  // Logo oficial - versión azul sobre blanco
  logoBlueOnWhite: process.env.BRAND_LOGO_URL || 'https://chilaquiles-top.web.app/logos/logo_blue.png',
  // Logo oficial - versión blanco sobre azul
  logoWhiteOnBlue: process.env.BRAND_LOGO_WHITE_URL || 'https://chilaquiles-top.web.app/logos/logo_white.png',
  // Mascota TopIA
  topIA: process.env.BRAND_TOPIA_URL || 'https://chilaquiles-top.web.app/logos/topia.png',
  // Foto hero por defecto del producto
  productDefault: 'https://chilaquiles-top.web.app/assets/hero_transparent-04-7IXms.png',
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

// Prompt base de diseño para la IA generadora de imágenes
export const buildImagePrompt = (designSpec, promotionData) => {
  const { headline, subheadline, price, cta, layout, useTopIA } = designSpec || {};
  const promoName = promotionData?.name || '';
  const promoPrice = promotionData?.price ? `Q${promotionData.price}` : (price || '');

  const baseRules = `
Professional social media promotional art for "Chilaquiles TOP", a modern fast-food restaurant in Villa Nueva, Guatemala.

STRICT BRAND COLORS - USE ONLY THESE:
- Primary background: Pure Blue #0000FF or White #FFFFFF
- Main brand: Electric Blue #0000FF (backgrounds, accents, identity)
- Action/CTA: Orange #FF6B00 (buttons, price highlights ONLY - use sparingly, max 10% of image)
- Text: White #FFFFFF on blue, Near-black #0B0B12 on white
- Supporting: Lavender #E5E6FC for soft backgrounds, Gold #F2B705 for food accents
- Official gradient: linear-gradient from #0000FF to #FF6B00 (for borders/lines only)

COLOR PROPORTION RULE:
60% Blue or White (dominant)
30% Content/Photography/Black text
10% Orange accents (CTA only)

DESIGN RULES:
- Clean, premium, modern look. NOT cluttered.
- Large readable headline (bold/black weight)
- Price clearly visible in a blue circle or pill shape
- CTA button: orange pill shape, rounded (border-radius 999px)
- Logo area reserved top-left (leave space, do NOT generate a logo yourself)
- Card elements: border-radius 24px, soft shadow
- NO random colors. NO gradients as main backgrounds (only as thin accent lines)
- Feel: technological, clean, close to the customer

⚠️ REAL CONTACT DATA - ALWAYS USE EXACTLY THESE, NEVER INVENT:
- WhatsApp: ${BRAND_CONTACT.whatsapp}
- Order link: ${BRAND_CONTACT.orderUrl}
- Website: ${BRAND_CONTACT.landingUrl}
- Location: ${BRAND_CONTACT.location}
- Delivery: ${BRAND_CONTACT.deliveryArea}
- Instagram: ${BRAND_CONTACT.instagram}
- Hashtags: ${BRAND_CONTACT.hashtags.join(' ')}
If the design includes a QR code, phone number, URL, or any contact detail — use ONLY the data above, never invent it.
`;

  const contentBlock = `
CONTENT TO DISPLAY:
${promoName ? `- Promotion: ${promoName}` : ''}
${promoPrice ? `- Price: ${promoPrice} (show in blue circle, very visible)` : ''}
${headline ? `- Headline: "${headline}"` : ''}
${subheadline ? `- Subheadline: "${subheadline}"` : ''}
${cta ? `- CTA button text: "${cta}"` : `- CTA button: "ORDENAR AHORA →" linking to ${BRAND_CONTACT.orderUrl}`}
- WhatsApp for orders: ${BRAND_CONTACT.whatsapp}
${useTopIA ? '- Include space for TopIA mascot character (friendly cartoon robot/food character) on the right side' : ''}
- Include chilaquiles food photography style elements (warm tones, appetizing)
- Bottom: hashtags ${BRAND_CONTACT.hashtags.join(' ')} (small, subtle)
`;

  const formatBlock = layout === 'instagram_story' || layout === 'story_cta'
    ? 'FORMAT: Vertical 9:16 ratio for Instagram Story. Large headline at top, product center, CTA button bottom.'
    : 'FORMAT: Square 1:1 ratio for Instagram/Facebook feed post.';

  return `${baseRules}\n${contentBlock}\n${formatBlock}`;
};
