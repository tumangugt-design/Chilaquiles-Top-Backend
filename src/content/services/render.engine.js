import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveAsset, AssetCatalog } from '../config/asset.catalog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML_DIR = path.join(__dirname, '../../../public/html');

// Lee un archivo HTML de la carpeta public/html
const readHtmlFile = (filename) => {
  try {
    return fs.readFileSync(path.join(HTML_DIR, filename), 'utf-8');
  } catch (e) {
    console.error(`[RenderEngine] No se pudo leer ${filename}:`, e.message);
    return '';
  }
};

// Extrae un bloque de componente de HTML por su clase CSS
const extractComponent = (html, className) => {
  // Extraemos el bloque <style> + el elemento HTML del componente
  const styleRegex = new RegExp(`<style>[^<]*\\.${className}[\\s\\S]*?<\\/style>`, 'gi');
  const elementRegex = new RegExp(`<(?:div|header|footer|section)[^>]*class="[^"]*${className}[^"]*"[\\s\\S]*?<\\/(?:div|header|footer|section)>`, 'gi');

  let result = '';
  const styleMatch = styleRegex.exec(html);
  if (styleMatch) result += styleMatch[0] + '\n';

  const elementMatch = elementRegex.exec(html);
  if (elementMatch) result += elementMatch[0] + '\n';

  return result;
};

// Sustituye variables de plantilla {{VAR}} en el HTML
const injectVars = (html, vars = {}) => {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || '');
};

/**
 * Arma el HTML completo de 1080x1080 (post) o 1080x1920 (historia)
 * a partir del DesignSpec devuelto por la IA.
 */
export const buildHtmlFromSpec = (spec) => {
  const { selectedComponents = {}, copy = {}, objects = [], width = 1080, height = 1080 } = spec;

  // Leer archivos base
  const tokensCss = readHtmlFile('ct-tokens.css');
  const headersHtml = readHtmlFile('ct-headers.html');
  const footersHtml = readHtmlFile('ct-footers.html');
  const backgroundsHtml = readHtmlFile('ct-backgrounds.html');

  // Extraer componentes seleccionados por la IA
  const bgClass = selectedComponents.background || 'ct-bg--1';
  const headerClass = selectedComponents.header || 'ct-header--1';
  const footerClass = selectedComponents.footer || 'ct-footer--1';

  let bgBlock = extractComponent(backgroundsHtml, bgClass);
  let headerBlock = extractComponent(headersHtml, headerClass);
  let footerBlock = extractComponent(footersHtml, footerClass);

  // Variables de imagen para el header (logos reales de GitHub)
  const logoVars = {
    LOGO_WORD_BLANCO: AssetCatalog.logos.logo_word_blanco.url,
    LOGO_WORD_AZUL: AssetCatalog.logos.logo_word_azul.url,
    LOGO_CUADRADO_AZUL: AssetCatalog.logos.logo_cuadrado_azul.url,
    BADGE_TEXT: copy.badge || (copy.price ? `PRECIO ESPECIAL ${copy.price}` : 'CHILAQUILES TOP'),
  };

  headerBlock = injectVars(headerBlock, logoVars);
  bgBlock = injectVars(bgBlock, logoVars);
  footerBlock = injectVars(footerBlock, logoVars);

  // --- Construir el "body" del arte (copy + imágenes) ---
  const hasDark = bgClass === 'ct-bg--2'; // fondo oscuro → texto blanco
  const textColor = hasDark ? '#FFFFFF' : 'var(--ct-negro)';

  // Objeto imagen hero (plato o TopIA si existe)
  let heroHtml = '';
  const heroObj = objects.find(o => o.role === 'hero' || o.type === 'product' || o.type === 'topia');
  if (heroObj) {
    const imgUrl = resolveAsset(heroObj.assetId);
    if (imgUrl) {
      const heroWidth = heroObj.size?.width || 420;
      const shadow = heroObj.effects?.shadow === 'plate' ? 'filter: drop-shadow(0 24px 36px rgba(11,11,18,0.32));' : '';
      heroHtml = `
        <div style="
          position: absolute;
          left: 50%;
          top: 55%;
          transform: translate(-50%, -50%);
          width: ${heroWidth}px;
          z-index: 5;
        ">
          <img src="${imgUrl}" style="width: 100%; height: auto; ${shadow}" />
        </div>
      `;
    }
  }

  // Badge / chip de oferta
  const badgeHtml = (copy.badge && headerClass === 'ct-header--2') ? `
    <div style="
      position: absolute;
      top: 140px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--ct-naranja);
      color: #fff;
      font-family: var(--ct-font);
      font-weight: 700;
      font-size: 22px;
      letter-spacing: 2px;
      text-transform: uppercase;
      padding: 10px 30px;
      border-radius: 999px;
      box-shadow: var(--ct-sh-nrj);
      z-index: 10;
      white-space: nowrap;
    ">${copy.badge}</div>
  ` : '';

  // Headline principal
  const headlineHtml = copy.headline ? `
    <div style="
      position: absolute;
      top: ${heroObj ? '25%' : '35%'};
      left: 50%;
      transform: translateX(-50%);
      width: 90%;
      text-align: center;
      z-index: 10;
    ">
      <h1 style="
        font-family: var(--ct-font);
        font-size: ${copy.headline.length > 20 ? '70px' : '90px'};
        font-weight: 900;
        color: ${copy.price ? 'var(--ct-naranja)' : (hasDark ? '#FFFFFF' : 'var(--ct-azul)')};
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
        margin: 16px 0 0 0;
        line-height: 1.3;
      ">${copy.subheadline}</p>` : ''}
    </div>
  ` : '';

  // Círculo de precio
  const priceHtml = copy.price ? `
    <div style="
      position: absolute;
      right: 60px;
      top: ${heroObj ? '42%' : '50%'};
      transform: translateY(-50%);
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
      transform: translateY(-50%) rotate(5deg);
    ">
      <span style="font-size: 50px; line-height: 1;">${copy.price}</span>
      ${copy.validUntil ? `<span style="font-size: 14px; font-weight: 600; opacity: 0.85; margin-top: 4px; text-align:center; padding: 0 10px;">Válido hasta ${copy.validUntil}</span>` : ''}
    </div>
  ` : '';

  // CTA Button (verde como en la imagen de referencia)
  const ctaHtml = copy.cta ? `
    <div style="
      position: absolute;
      bottom: 120px;
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
      display: flex;
      align-items: center;
      gap: 14px;
    ">
      <svg width="26" height="26" viewBox="0 0 32 32" fill="#FFFFFF"><path d="M16 .4C7.4.4.5 7.3.5 15.9c0 2.8.7 5.4 2 7.8L.4 31.6l8.1-2.1c2.3 1.2 4.8 1.9 7.5 1.9 8.6 0 15.5-7 15.5-15.5C31.5 7.3 24.6.4 16 .4zm7.1 18.9c-.4-.2-2.3-1.1-2.6-1.3-.3-.1-.6-.2-.9.2-.3.4-1 1.3-1.2 1.5-.2.2-.4.3-.8.1-.4-.2-1.6-.6-3.1-1.9-1.1-1-1.9-2.3-2.2-2.7-.2-.4 0-.6.2-.8.2-.2.4-.4.5-.7.2-.2.2-.4.4-.7.1-.3.1-.5 0-.7-.1-.2-.9-2.2-1.3-3-.3-.8-.7-.7-.9-.7h-.8c-.3 0-.7.1-1.1.5-.4.4-1.4 1.4-1.4 3.4s1.5 3.9 1.7 4.2c.2.3 2.9 4.5 7.1 6.3 1 .4 1.8.7 2.4.9 1 .3 1.9.3 2.6.2.8-.1 2.3-1 2.7-1.9.3-.9.3-1.7.2-1.9-.1-.2-.4-.3-.8-.5z"/></svg>
      ${copy.cta}
    </div>
  ` : '';

  // Si hay un hero, insertar inline en el bg (el footer va al final)
  // El bg extrae solo el div inicial — necesitamos inyectar contenido dentro del .ct-bg
  // Hacemos: reemplazar el comentario "CONTENIDO DE LA PIEZA AQUÍ" dentro del bg
  const bodyContent = `${badgeHtml}${headlineHtml}${priceHtml}${heroHtml}${ctaHtml}`;

  let bgWithContent = bgBlock.replace('<!-- CONTENIDO DE LA PIEZA AQUÍ -->', bodyContent);

  // Inyectar header al inicio del bg (dentro del primer div del bg)
  // Estrategia: el header es un element separado que se pone en position:absolute top:0
  // Lo más simple: envolver todo en un contenedor relativo
  
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    ${tokensCss}
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800;900&display=swap');
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      font-family: var(--ct-font);
    }

    .ct-canvas {
      position: relative;
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
    }

    .ct-bg {
      width: ${width}px !important;
      height: ${height}px !important;
    }

    .ct-header {
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      width: 100% !important;
      z-index: 20 !important;
    }

    .ct-footer {
      position: absolute !important;
      bottom: 0 !important;
      left: 0 !important;
      width: 100% !important;
      z-index: 20 !important;
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

  return html;
};

/**
 * Renderiza el spec a PNG usando Puppeteer
 */
export const renderImageFromSpec = async (spec) => {
  const html = buildHtmlFromSpec(spec);

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({
      width: spec.width || 1080,
      height: spec.height || 1080,
      deviceScaleFactor: 1
    });

    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

    // Espera extra para imágenes remotas
    await new Promise(r => setTimeout(r, 1500));

    const buffer = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: spec.width || 1080, height: spec.height || 1080 } });
    return buffer;
  } finally {
    await browser.close();
  }
};
