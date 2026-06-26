import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveAsset, AssetCatalog } from '../config/asset.catalog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ruta correcta a los componentes HTML
const COMPONENTS_DIR = path.join(__dirname, '../templates/components');

// Lee un archivo de la carpeta de componentes
const readComponent = (filename) => {
  try {
    return fs.readFileSync(path.join(COMPONENTS_DIR, filename), 'utf-8');
  } catch (e) {
    console.error(`[RenderEngine] No se pudo leer ${filename}:`, e.message);
    return '';
  }
};

/**
 * Extrae el bloque completo de un componente HTML por nombre de clase.
 * Busca el <style> que define la clase y el elemento HTML que la usa.
 * Estrategia: dividir el archivo por bloques separados por comentarios HTML.
 */
const extractComponentBlock = (fullHtml, className) => {
  // Quita los comentarios de tipo <!-- ... --> para no interferir
  // Dividimos en secciones: cada sección es un bloque de <style>+<element>
  const blocks = fullHtml.split(/(?=<style>)/i);

  for (const block of blocks) {
    // Buscar si este bloque tiene la clase que necesitamos
    if (block.includes(`.${className}`)) {
      return block.trim();
    }
  }

  console.warn(`[RenderEngine] No se encontró el componente: ${className}`);
  return '';
};

/**
 * Sustituye variables {{VARIABLE}} en un string HTML.
 */
const injectVars = (html, vars = {}) => {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] !== undefined ? vars[key] : '');
};

/**
 * Construye el HTML completo del arte a partir del DesignSpec generado por la IA.
 */
export const buildHtmlFromSpec = (spec) => {
  const {
    selectedComponents = {},
    copy = {},
    objects = [],
    width = 1080,
    height = 1080,
  } = spec;

  // Leer los archivos de componentes
  const tokensCss  = readComponent('ct-tokens.css');
  const headersHtml = readComponent('ct-headers.html');
  const footersHtml = readComponent('ct-footers.html');
  const bgHtml      = readComponent('ct-backgrounds.html');

  // Seleccionar los componentes que eligió la IA
  const bgClass     = selectedComponents.background || 'ct-bg--1';
  const headerClass = selectedComponents.header     || 'ct-header--1';
  const footerClass = selectedComponents.footer     || 'ct-footer--1';

  // Extraer los bloques
  let bgBlock     = extractComponentBlock(bgHtml,      bgClass);
  let headerBlock = extractComponentBlock(headersHtml, headerClass);
  let footerBlock = extractComponentBlock(footersHtml, footerClass);

  // Variables de marca para inyectar en los componentes
  const isPromo = !!copy.price;
  const logoVars = {
    LOGO_WORD_BLANCO:   AssetCatalog.logos.logo_word_blanco.url,
    LOGO_WORD_AZUL:     AssetCatalog.logos.logo_word_azul.url,
    LOGO_CUADRADO_AZUL: AssetCatalog.logos.logo_cuadrado_azul.url,
    BADGE_TEXT: copy.badge || (isPromo ? 'OFERTA LIMITADA' : 'CHILAQUILES TOP'),
  };

  headerBlock = injectVars(headerBlock, logoVars);
  bgBlock     = injectVars(bgBlock,     logoVars);
  footerBlock = injectVars(footerBlock, logoVars);


  // ══════════════════════════════════════════════════════════════
  // ESQUEMA DE COLORES — 100% tokens del sistema (ct-tokens.css)
  //
  // BG1 (claro/lavanda) → texto azul o negro, acentos naranja
  // BG2 (oscuro premium) → texto blanco, acentos lavanda/naranja
  // BG3 (diagonal azul/blanco) → panel izq oscuro, panel der claro
  // ══════════════════════════════════════════════════════════════
  const COLOR_SCHEMES = {
    'ct-bg--1': {
      isDark:         false,
      headlineColor:  'var(--ct-azul)',        // azul fuerte sobre fondo claro
      subheadColor:   'var(--ct-negro)',        // negro profundo para legibilidad
      badgeBg:        'var(--ct-naranja)',
      badgeText:      'var(--ct-blanco)',
      priceBg:        'var(--ct-azul)',
      priceText:      'var(--ct-blanco)',
      validUntilBg:   'rgba(255,255,255,0.92)',
      validUntilBorder:'var(--ct-azul)',
      validUntilColor: 'var(--ct-azul)',
    },
    'ct-bg--2': {
      isDark:         true,
      headlineColor:  'var(--ct-lavanda)',      // lavanda para fondo oscuro
      subheadColor:   'rgba(229,230,252,0.85)', // lavanda semitransparente
      badgeBg:        'var(--ct-naranja)',
      badgeText:      'var(--ct-blanco)',
      priceBg:        'var(--ct-naranja)',      // naranja sobre oscuro resalta más
      priceText:      'var(--ct-blanco)',
      validUntilBg:   'rgba(229,230,252,0.15)',
      validUntilBorder:'var(--ct-lavanda)',
      validUntilColor: 'var(--ct-lavanda)',
    },
    'ct-bg--3': {
      isDark:         false,
      headlineColor:  'var(--ct-azul)',
      subheadColor:   'var(--ct-negro)',
      badgeBg:        'var(--ct-naranja)',
      badgeText:      'var(--ct-blanco)',
      priceBg:        'var(--ct-naranja)',      // naranja sobre bg3 combina con acento
      priceText:      'var(--ct-blanco)',
      validUntilBg:   'rgba(255,255,255,0.95)',
      validUntilBorder:'var(--ct-naranja)',
      validUntilColor: 'var(--ct-naranja)',
    },
  };

  const scheme = COLOR_SCHEMES[bgClass] || COLOR_SCHEMES['ct-bg--1'];

  // En promos, el headline siempre en naranja para que resalte la oferta
  const headlineColor = isPromo ? 'var(--ct-naranja)' : scheme.headlineColor;


  // ── Foto del plato (hero product)
  const heroObj = objects.find(o => o.role === 'hero' || o.type === 'product');
  // ══════════════════════════════════════════════════════════════
  // LAYOUT DE 3 ZONAS — El plato NUNCA se superpone al texto
  //
  // ZONA 1 (TOP):    Header + Badge + Headline + Subheadline
  // ZONA 2 (MEDIO):  Foto del plato + Círculo de precio
  // ZONA 3 (BOTTOM): Válido hasta + CTA + Footer
  // ══════════════════════════════════════════════════════════════
  const headerHeight = headerClass === 'ct-header--1' ? 280 : (headerClass === 'ct-header--2' ? 120 : 162);
  const footerHeight = 104;

  // Área disponible total
  const availableTop    = headerHeight;
  const availableBottom = height - footerHeight;
  const availableHeight = availableBottom - availableTop;

  // Con plato: dividimos en zonas fijas
  // Zona texto: 35% del área disponible (arriba del plato)
  // Zona plato: 40% del área (centro)
  // Zona CTA:   25% del área (abajo)
  const ZONE_TEXT_RATIO  = 0.35;
  const ZONE_PLATE_RATIO = 0.40;

  const zoneTextTop    = availableTop;
  const zoneTextHeight = Math.round(availableHeight * ZONE_TEXT_RATIO);
  const zonePlateTop   = zoneTextTop + zoneTextHeight;
  const zonePlateHeight = Math.round(availableHeight * ZONE_PLATE_RATIO);
  const zoneCtaTop     = zonePlateTop + zonePlateHeight;

  // ── Foto del plato (posicionada dentro de Zona 2 siempre)
  let heroHtml = '';
  if (heroObj) {
    const imgUrl = resolveAsset(heroObj.assetId);
    if (imgUrl) {
      const plateCenterY = zonePlateTop + Math.round(zonePlateHeight / 2);
      heroHtml = `
        <div style="
          position: absolute;
          left: 50%;
          top: ${plateCenterY}px;
          transform: translate(-50%, -50%);
          width: 85%;
          height: ${zonePlateHeight}px;
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 5;
        ">
          <img src="${imgUrl}"
               style="max-width: 100%; max-height: 100%; object-fit: contain; filter: drop-shadow(0 24px 36px rgba(11,11,18,0.35));"
               crossorigin="anonymous" />
        </div>`;
    }
  }

  const hasHero = !!heroHtml;

  // Badge en el body SOLO si se usa ct-header--3
  const showBodyBadge = copy.badge && headerClass === 'ct-header--3';

  // ── Badge
  const badgeHtml = showBodyBadge ? `
    <div style="
      position: absolute;
      top: ${headerHeight + 28}px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--ct-naranja);
      color: #fff;
      font-family: var(--ct-font);
      font-weight: 700;
      font-size: 22px;
      letter-spacing: 2px;
      text-transform: uppercase;
      padding: 10px 32px;
      border-radius: 999px;
      box-shadow: var(--ct-sh-nrj);
      z-index: 10;
      white-space: nowrap;
      display: inline-flex;
      align-items: center;
      gap: 10px;
    ">
      <span style="width:10px;height:10px;border-radius:50%;background:${scheme.badgeText};flex-shrink:0;"></span>
      ${copy.badge}
    </div>` : '';

  // ── Headline: siempre en Zona 1 (texto), centrado en esa zona
  const hasBodyText = !!copy.bodyText;
  const headlineCenterY = hasHero
    ? zoneTextTop + Math.round(zoneTextHeight * 0.35)   // más arriba para no tocar el plato
    : isPromo
      ? availableTop + Math.round(availableHeight * 0.18) // promo sin plato: más arriba
      : hasBodyText
        ? availableTop + Math.round(availableHeight * 0.15) // muy arriba para dejar espacio al texto largo
        : availableTop + Math.round(availableHeight * 0.35); // otro tema sin body: centrado alto

  // Tamaño de fuente: más corto = más grande
  const h1FontSize = copy.headline.length > 22 ? '58px'
    : copy.headline.length > 16 ? '68px'
    : copy.headline.length > 12 ? '78px'
    : '88px';

  const headlineHtml = copy.headline ? `
    <div style="
      position: absolute;
      top: ${headlineCenterY}px;
      left: 50%;
      transform: translate(-50%, -50%);
      width: ${hasHero ? '86%' : '88%'};
      text-align: center;
      z-index: 10;
    ">
      <h1 style="
        font-family: var(--ct-font);
        font-size: ${h1FontSize};
        font-weight: 900;
        color: ${headlineColor};
        text-transform: uppercase;
        line-height: 1.05;
        margin: 0;
        letter-spacing: -1px;
      ">${copy.headline}</h1>
      ${copy.subheadline ? `<p style="
        font-family: var(--ct-font);
        font-size: ${hasHero ? '24px' : '28px'};
        font-weight: 500;
        color: ${scheme.subheadColor};
        margin: 14px 0 0 0;
        line-height: 1.4;
        max-width: ${hasHero ? '700px' : '800px'};
        margin-left: auto;
        margin-right: auto;
      ">${copy.subheadline}</p>` : ''}
    </div>` : '';

  // ── Body Text (para comunicados largos sin plato) — Zona 2 (Centro)
  const bodyTextHtml = (copy.bodyText && !hasHero) ? `
    <div style="
      position: absolute;
      top: ${availableTop + Math.round(availableHeight * 0.55)}px;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 82%;
      text-align: left;
      z-index: 10;
      font-family: var(--ct-font);
      font-size: 22px;
      font-weight: 500;
      color: ${scheme.subheadColor};
      line-height: 1.7;
      background: linear-gradient(145deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.75) 100%);
      padding: 40px 48px;
      border-radius: 32px;
      border: 1px solid rgba(255, 255, 255, 1);
      box-shadow: 0 24px 48px rgba(0,0,0,0.08), inset 0 2px 0 rgba(255,255,255,1);
      backdrop-filter: blur(16px);
    ">
      ${copy.bodyText.replace(/\n/g, '<br/>')}
    </div>` : '';

  // ── Precio (solo para promos) — posicionado en Zona 2 (junto al plato)
  const priceCenterY = hasHero
    ? zonePlateTop + Math.round(zonePlateHeight * 0.35)   // arriba-derecha del plato
    : availableTop + Math.round(availableHeight * 0.52);  // centrado si no hay plato
  const priceRight = '60px';

  const priceHtml = (isPromo && copy.price) ? `
    <div style="
      position: absolute;
      right: ${priceRight};
      top: ${priceCenterY}px;
      transform: rotate(5deg);
      width: 190px;
      height: 190px;
      background: ${scheme.priceBg};
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: ${scheme.priceText};
      font-family: var(--ct-font);
      font-weight: 900;
      z-index: 15;
      box-shadow: ${scheme.priceBg === 'var(--ct-naranja)' ? 'var(--ct-sh-nrj)' : 'var(--ct-sh-azul)'};
    ">
      <span style="font-size:52px;line-height:1;">${copy.price}</span>
    </div>` : '';

  // ── Válido hasta (SOLO en promos) — Zona 3, encima del botón CTA
  // Se posiciona desde zoneCtaTop o con bottom fijo
  const validUntilBottom = footerHeight + 108; // justo encima del CTA
  const validUntilHtml = (isPromo && copy.validUntil) ? `
    <div style="
      position: absolute;
      bottom: ${validUntilBottom}px;
      left: 50%;
      transform: translateX(-50%);
      background: ${scheme.validUntilBg};
      border: 1.5px solid ${scheme.validUntilBorder};
      color: ${scheme.validUntilColor};
      font-family: var(--ct-font);
      font-size: 19px;
      font-weight: 600;
      padding: 8px 24px;
      border-radius: 999px;
      z-index: 12;
      white-space: nowrap;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    ">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      Válido hasta el ${copy.validUntil}
    </div>` : '';

  // ── CTA Button (WhatsApp — SOLO en promos)
  const ctaHtml = (isPromo && copy.cta) ? `
    <div style="
      position: absolute;
      bottom: 116px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--ct-verde);
      color: #fff;
      font-family: var(--ct-font);
      font-size: 28px;
      font-weight: 800;
      padding: 22px 60px;
      border-radius: 999px;
      text-transform: uppercase;
      z-index: 20;
      box-shadow: var(--ct-sh-verde);
      white-space: nowrap;
      display: inline-flex;
      align-items: center;
      gap: 14px;
    ">
      <svg width="26" height="26" viewBox="0 0 32 32" fill="#FFFFFF"><path d="M16 .4C7.4.4.5 7.3.5 15.9c0 2.8.7 5.4 2 7.8L.4 31.6l8.1-2.1c2.3 1.2 4.8 1.9 7.5 1.9 8.6 0 15.5-7 15.5-15.5C31.5 7.3 24.6.4 16 .4zm7.1 18.9c-.4-.2-2.3-1.1-2.6-1.3-.3-.1-.6-.2-.9.2-.3.4-1 1.3-1.2 1.5-.2.2-.4.3-.8.1-.4-.2-1.6-.6-3.1-1.9-1.1-1-1.9-2.3-2.2-2.7-.2-.4 0-.6.2-.8.2-.2.4-.4.5-.7.2-.2.2-.4.4-.7.1-.3.1-.5 0-.7-.1-.2-.9-2.2-1.3-3-.3-.8-.7-.7-.9-.7h-.8c-.3 0-.7.1-1.1.5-.4.4-1.4 1.4-1.4 3.4s1.5 3.9 1.7 4.2c.2.3 2.9 4.5 7.1 6.3 1 .4 1.8.7 2.4.9 1 .3 1.9.3 2.6.2.8-.1 2.3-1 2.7-1.9.3-.9.3-1.7.2-1.9-.1-.2-.4-.3-.8-.5z"/></svg>
      PIDE POR WHATSAPP
    </div>` : '';


  // ── Inyectar contenido dentro del background
  const bodyContent = `${badgeHtml}${headlineHtml}${bodyTextHtml}${priceHtml}${heroHtml}${validUntilHtml}${ctaHtml}`;
  let bgWithContent = bgBlock.replace('<!-- CONTENIDO DE LA PIEZA AQUÍ -->', bodyContent);

  // ── Armar HTML final
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800;900&display=swap');
    ${tokensCss}
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      font-family: var(--ct-font), 'Poppins', sans-serif;
    }
    .ct-canvas {
      position: relative;
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
    }
    /* Forzar tamaño del background */
    .ct-bg {
      width: ${width}px !important;
      height: ${height}px !important;
    }
    /* Header y footer siempre pegados al borde */
    .ct-header {
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      width: 100% !important;
      z-index: 30 !important;
    }
    .ct-footer {
      position: absolute !important;
      bottom: 0 !important;
      left: 0 !important;
      width: 100% !important;
      z-index: 30 !important;
    }
  </style>
</head>
<body>
  <div class="ct-canvas">
    ${bgWithContent}
    ${headerBlock}
    ${footerBlock}
  </div>
</body>
</html>`;
};

/**
 * Renderiza el DesignSpec a PNG usando Browserless.io (sin Puppeteer local).
 */
export const renderImageFromSpec = async (spec) => {
  const BROWSERLESS_TOKEN = process.env.BROWSERLESS_TOKEN;
  if (!BROWSERLESS_TOKEN) {
    throw new Error('BROWSERLESS_TOKEN is missing. Set it in Cloud Run environment variables.');
  }

  const html = buildHtmlFromSpec(spec);
  const width = spec.width || 1080;
  const height = spec.height || 1080;

  console.log('[RenderEngine] Sending HTML to Browserless, size:', html.length, 'chars');

  const response = await fetch(`https://production-sfo.browserless.io/screenshot?token=${BROWSERLESS_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      html,
      options: {
        type: 'png',
        clip: { x: 0, y: 0, width, height }
      },
      viewport: { width, height }
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Browserless error ${response.status}: ${err}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
};