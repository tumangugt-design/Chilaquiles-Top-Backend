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
  const isStory = layout === 'instagram_story' || layout === 'story_cta';

  const topiaInstructions = includeTopIA
    ? `MASCOT CHARACTER (first reference image provided):
The first image shows our official brand mascot. You MUST integrate this exact character naturally into the promotional art. The character should appear as a natural part of the scene — perhaps presenting the promotion, pointing at the price, or standing next to the food. Make it look like the character was always part of this design, NOT like it was pasted on top. Scale and position appropriately so it feels integrated.`
    : `Do NOT include any mascot, cartoon character, or illustrated figure.`;

  const plateInstructions = includePlate
    ? `REAL FOOD PHOTO (reference image provided):
One of the reference images shows a real photo of our chilaquiles plate. Integrate this real food photograph naturally into the design — place it prominently as the hero food visual. Blend it into the composition naturally with the brand colors. Make it appetizing and central to the design.`
    : `This is a TYPOGRAPHIC and GRAPHIC design — do NOT draw or illustrate any food, bowls, plates, or dishes. Focus on text, shapes, and brand identity only.`;

  return `You are a world-class Latin American food brand designer creating a premium social media promotional art for "Chilaquiles TOP" restaurant in Villa Nueva, Guatemala.

${isStory ? 'This is a VERTICAL story format (9:16 aspect ratio, like a phone screen in portrait mode). Design with tall vertical composition — logo at top, large bold headline in the center, CTA button near the bottom.' : 'This is a SQUARE post format (1:1 ratio). Design with balanced square composition.'}

BRAND COLORS — use ONLY these colors:
- Pure Blue (brand primary): use for backgrounds, identity, price circles, bold design elements
- White: use for breathing space, clean areas, text on blue backgrounds
- Near-black: use for body text on white backgrounds only
- Orange (accent only, maximum 10% of the design): use ONLY for the CTA action button — nothing else
- Light lavender: use for soft secondary card backgrounds
- Gold/corn yellow: subtle food accent only

Color rule: 60% blue or white, 30% text and design elements, 10% orange accent.

${topiaInstructions}

${plateInstructions}

LOGO: The last reference image is our official logo. Place it in the top-left corner of the design. Use the actual logo as provided — do not redraw or recreate it. Reserve that corner space.

CONTENT TO INCLUDE:
${promoName ? `- Promotion name: ${promoName}` : ''}
${promoPrice ? `- Price: ${promoPrice} — show in a bold filled blue circle, large and immediately readable` : ''}
${headline ? `- Main headline: "${headline}"` : '- Write a compelling short Spanish headline for this promotion (maximum 4 words, bold)'}
${subheadline ? `- Secondary text: "${subheadline}"` : ''}
- Action button (orange, fully rounded pill shape): "${cta || 'ORDENAR AHORA'}"
- WhatsApp contact: ${BRAND_CONTACT.whatsapp}
- Small hashtags at the bottom: ${BRAND_CONTACT.hashtags.join(' ')}

DESIGN QUALITY STANDARDS:
- Premium, modern, clean. Must look like it was made by a professional design agency.
- Bold typography hierarchy: headline dominant, price very visible, CTA clear and tappable.
- Use geometric shapes (circles, rounded rectangles) as design accents.
- A thin horizontal line with a gradient from blue to orange can be used as a visual separator.
- No cluttered layouts. Good whitespace. Readable at a glance on mobile.
- Do not include any code, technical terms, color hex codes, or developer syntax anywhere in the image.
- The result must feel technological, clean, vibrant, and recognizably "Chilaquiles TOP".`;
};
