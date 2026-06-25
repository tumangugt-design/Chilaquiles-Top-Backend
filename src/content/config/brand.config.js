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

// Expert marketing art prompt builder
export const buildImagePrompt = (designSpec, promotionData) => {
  const { headline, subheadline, price, cta, layout, includeTopIA, includePlate } = designSpec || {};
  const promoName = promotionData?.name || '';
  const promoPrice = promotionData?.price ? `Q${promotionData.price}` : (price || '');
  const isStory = layout === 'instagram_story' || layout === 'story_cta';

  return `You are an expert Latin American food brand marketing designer. Create a premium social media promotional image for "Chilaquiles TOP" restaurant, Villa Nueva, Guatemala.

═══════════════════════════════
MANDATORY BRAND COLORS (no exceptions):
- #0000FF Pure Blue → backgrounds, identity, price circles
- #FFFFFF White → breathing space, cards, clean areas
- #0B0B12 Near-Black → body text on white
- #FF6B00 Orange → ONLY for CTA button (max 10% of image)
- #E5E6FC Lavender → soft card backgrounds
- #F2B705 Gold → subtle food accent only
Color law: 60% blue/white · 30% text/content · 10% orange

═══════════════════════════════
PROMOTION CONTENT:
${promoName ? `• Name: ${promoName}` : ''}
${promoPrice ? `• Price: ${promoPrice} — display inside a bold blue filled circle, large and clear` : ''}
${headline ? `• Main headline: "${headline}"` : '• Create a compelling Spanish headline about this promotion'}
${subheadline ? `• Sub-headline: "${subheadline}"` : ''}
• CTA pill button (orange #FF6B00, border-radius 999px): "${cta || 'ORDENAR AHORA →'}"
• WhatsApp: ${BRAND_CONTACT.whatsapp}
• Order: ${BRAND_CONTACT.orderUrl}
• Hashtags (tiny, at bottom): ${BRAND_CONTACT.hashtags.join(' ')}

═══════════════════════════════
LAYOUT ZONES — RESPECT THESE STRICTLY:
• TOP-LEFT corner (120×120px area): LEAVE COMPLETELY EMPTY — the real logo will be placed here programmatically. Do NOT draw any logo, icon, text, or placeholder in this zone.
${includePlate ? `• BOTTOM-LEFT area: Leave clear space for a real food plate photo that will be composited on top. Design the background/colors to work well with a food image placed there.` : '• DO NOT draw any food photos, bowls, plates or dishes anywhere in the image. The design must be purely typographic and graphic.'}
${includeTopIA ? `• BOTTOM-RIGHT corner: Leave a natural space for a friendly mascot character. The layout should visually "invite" a character to stand there — perhaps with a speech bubble, a colored zone, or simply open space.` : '• DO NOT draw any mascot, character, or cartoon.'}

═══════════════════════════════
DESIGN EXCELLENCE RULES:
• Premium, clean, modern aesthetic — NOT cheap or generic
• Bold typography hierarchy: main headline very large, price huge, CTA clear
• Geometric shapes allowed: circles, rounded rectangles, gradient lines
• Thin gradient accent line (blue→orange) can be used as a separator
• Card elements: border-radius 24px, soft shadow if needed
• NO stock photo backgrounds — use flat color or subtle geometric patterns
• NO QR codes (unless explicitly requested)
• NO invented phone numbers, URLs, or addresses
• The image must feel like it was designed by a professional studio

${isStory ? 'FORMAT: Vertical 9:16 (1080×1920px). Big bold text top, visual center, CTA bottom.' : 'FORMAT: Square 1:1 (1080×1080px). Clean grid layout.'}`;
};
