import puppeteer from 'puppeteer';
import { ComponentRegistry, getComponent } from '../templates/component.registry.js';
import { AssetCatalog, resolveAsset } from '../config/asset.catalog.js';

const replaceTemplateVariables = (html, spec) => {
  let result = html;
  
  // Logos
  result = result.replace(/{{LOGO_WORD_BLANCO}}/g, AssetCatalog.logos.logo_word_blanco.url);
  result = result.replace(/{{LOGO_WORD_AZUL}}/g, AssetCatalog.logos.logo_word_azul.url);
  result = result.replace(/{{LOGO_CUADRADO_AZUL}}/g, AssetCatalog.logos.logo_cuadrado_azul.url);
  
  // Texts
  result = result.replace(/{{BADGE_TEXT}}/g, spec.copy?.badge || '');
  
  return result;
};

const buildObjectsHtml = (objects) => {
  if (!objects || !Array.isArray(objects)) return '';
  
  return objects.map(obj => {
    const url = resolveAsset(obj.assetId) || obj.assetId;
    if (obj.type === 'product' || obj.type === 'image' || obj.assetId) {
      return `
        <img 
          src="${url}" 
          style="
            position: absolute;
            left: ${obj.position?.x || 540}px;
            top: ${obj.position?.y || 540}px;
            width: ${obj.size?.width || 300}px;
            transform: translate(-50%, -50%) rotate(${obj.effects?.rotation || 0}deg);
            z-index: ${obj.layer || 5};
            ${obj.effects?.shadow === 'plate' ? 'filter: drop-shadow(0 20px 30px rgba(0,0,0,0.3));' : ''}
          "
        />
      `;
    }
    // Handle text objects later if AI generates them instead of using standard text blocks
    return '';
  }).join('');
};

export const buildHtmlSnapshot = (spec) => {
  const { selectedComponents, objects, copy } = spec;
  
  const bgHtml = getComponent('backgrounds', selectedComponents?.background) || '';
  const headerHtml = getComponent('headers', selectedComponents?.header) || '';
  const footerHtml = getComponent('footers', selectedComponents?.footer) || '';
  const tokensCss = ComponentRegistry.tokens;

  // Build the textual body based on the copy, if no predefined text components
  // In a full implementation, we might have ct-body components.
  // For now we'll inject a generic body block based on the layout rules
  const isHistoria = spec.format === 'historia';
  
  const bodyHtml = `
    <div style="position: absolute; top: 350px; left: 0; width: 100%; text-align: center; z-index: 10; font-family: var(--ct-font);">
      ${copy?.headline ? `<h1 style="font-size: 80px; color: var(--ct-azul); text-transform: uppercase; margin: 0; padding: 0 40px; font-weight: 900; line-height: 1;">${copy.headline}</h1>` : ''}
      ${copy?.subheadline ? `<p style="font-size: 32px; color: var(--ct-negro); margin: 20px 0 0 0; font-weight: 600;">${copy.subheadline}</p>` : ''}
    </div>
    
    ${copy?.price ? `
      <div style="position: absolute; right: 80px; top: 400px; width: 180px; height: 180px; background: var(--ct-azul); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--ct-blanco); font-family: var(--ct-font); font-size: 60px; font-weight: 900; z-index: 15; box-shadow: 0 10px 30px rgba(0,0,255,0.4); transform: rotate(5deg);">
        ${copy.price}
      </div>
    ` : ''}

    ${copy?.cta ? `
      <div style="position: absolute; bottom: 250px; left: 50%; transform: translateX(-50%); background: var(--ct-naranja); color: var(--ct-blanco); font-family: var(--ct-font); font-size: 28px; font-weight: 800; padding: 20px 60px; border-radius: 50px; text-transform: uppercase; z-index: 20; box-shadow: 0 15px 30px rgba(255,107,0,0.4);">
        ${copy.cta}
      </div>
    ` : ''}
  `;

  const objectsHtml = buildObjectsHtml(objects);

  const rawHtml = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <style>
        ${tokensCss}
        body { margin: 0; padding: 0; width: ${spec.width}px; height: ${spec.height}px; overflow: hidden; position: relative; background: #fff; }
        .canvas-container { position: relative; width: 100%; height: 100%; overflow: hidden; }
        
        /* Absolutes for header/footer so they overlay backgrounds properly */
        .header-wrapper { position: absolute; top: 0; left: 0; width: 100%; z-index: 20; }
        .footer-wrapper { position: absolute; bottom: 0; left: 0; width: 100%; z-index: 20; }
        .bg-wrapper { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1; }
      </style>
      <!-- Load Montserrat font from Google -->
      <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800;900&display=swap" rel="stylesheet">
    </head>
    <body>
      <div class="canvas-container">
        <div class="bg-wrapper">${bgHtml}</div>
        <div class="header-wrapper">${headerHtml}</div>
        ${bodyHtml}
        ${objectsHtml}
        <div class="footer-wrapper">${footerHtml}</div>
      </div>
    </body>
    </html>
  `;

  return replaceTemplateVariables(rawHtml, spec);
};

export const renderImageFromSpec = async (spec) => {
  const html = buildHtmlSnapshot(spec);
  
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: spec.width, height: spec.height, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const buffer = await page.screenshot({ type: 'png' });
    return buffer;
  } finally {
    await browser.close();
  }
};
