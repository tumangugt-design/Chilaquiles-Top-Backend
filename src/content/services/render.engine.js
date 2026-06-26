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

  // ── Detectar si el fondo es oscuro para ajustar colores de texto
  const hasDark = bgClass === 'ct-bg--2';
  const textColor = hasDark ? '#FFFFFF' : 'var(--ct-negro)';

  // ── Foto del plato (hero product)
  const heroObj = objects.find(o => o.role === 'hero' || o.type === 'product');
  let heroHtml = '';
  if (heroObj) {
    const imgUrl = resolveAsset(heroObj.assetId);
    if (imgUrl) {
      heroHtml = `
        <div style="
          position: absolute;
          left: 50%;
          top: 58%;
          transform: translate(-50%, -50%);
          width: 480px;
          z-index: 5;
        ">
          <img src="${imgUrl}"
               style="width:100%;height:auto;filter:drop-shadow(0 24px 36px rgba(11,11,18,0.35));"
               crossorigin="anonymous" />
        </div>`;
    }
  }

  // ── Badge de oferta (solo si es promo Y el header es ct-header--1 que ya lo lleva,
  //    para los otros headers lo insertamos en el body debajo del header)
  const showBodyBadge = copy.badge && headerClass !== 'ct-header--1';
  const headerHeight = headerClass === 'ct-header--1' ? 280 : (headerClass === 'ct-header--2' ? 120 : 162);

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
      <span style="width:10px;height:10px;border-radius:50%;background:#fff;flex-shrink:0;"></span>
      ${copy.badge}
    </div>` : '';

  // ── Headline principal
  const headlineTopBase = headerHeight + (showBodyBadge ? 90 : 40);
  const headlineHtml = copy.headline ? `
    <div style="
      position: absolute;
      top: ${headlineTopBase}px;
      left: 50%;
      transform: translateX(-50%);
      width: 88%;
      text-align: center;
      z-index: 10;
    ">
      <h1 style="
        font-family: var(--ct-font);
        font-size: ${copy.headline.length > 16 ? '68px' : '88px'};
        font-weight: 900;
        color: ${isPromo ? 'var(--ct-naranja)' : (hasDark ? '#FFFFFF' : 'var(--ct-azul)')};
        text-transform: uppercase;
        line-height: 1.0;
        margin: 0;
        letter-spacing: -1px;
      ">${copy.headline}</h1>
      ${copy.subheadline ? `<p style="
        font-family: var(--ct-font);
        font-size: 30px;
        font-weight: 600;
        color: ${hasDark ? 'rgba(255,255,255,0.85)' : textColor};
        margin: 14px 0 0 0;
        line-height: 1.3;
      ">${copy.subheadline}</p>` : ''}
    </div>` : '';

  // ── Precio (círculo de precio para promos)
  const priceHtml = copy.price ? `
    <div style="
      position: absolute;
      right: 54px;
      top: ${heroObj ? '44%' : '50%'};
      transform: translateY(-50%) rotate(5deg);
      width: 190px;
      height: 190px;
      background: var(--ct-azul);
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-family: var(--ct-font);
      font-weight: 900;
      z-index: 15;
      box-shadow: var(--ct-sh-azul);
    ">
      <span style="font-size:52px;line-height:1;">${copy.price}</span>
      ${copy.validUntil ? `<span style="font-size:13px;font-weight:600;opacity:.85;margin-top:4px;text-align:center;padding:0 10px;">Válido hasta ${copy.validUntil}</span>` : ''}
    </div>` : '';

  // ── CTA Button
  const ctaHtml = copy.cta ? `
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
      ${copy.cta}
    </div>` : '';

  // ── Inyectar contenido dentro del background
  const bodyContent = `${badgeHtml}${headlineHtml}${priceHtml}${heroHtml}${ctaHtml}`;
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