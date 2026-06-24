import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// Sanitización básica para evitar inyección XSS
const escapeHTML = (str) => {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
};

// Limitar longitud de texto
const limitText = (text, maxLength = 100) => {
  if (!text) return '';
  const escaped = escapeHTML(text);
  return escaped.length > maxLength ? escaped.substring(0, maxLength) + '...' : escaped;
};

// Función para obtener el HTML base
const getTemplateHTML = (designSpec, assetUrl) => {
  const format = designSpec.format || 'instagram_feed';
  
  // Limites
  const headline = limitText(designSpec.headline, 60);
  const subheadline = limitText(designSpec.subheadline, 80);
  const price = limitText(designSpec.price, 20);
  const cta = limitText(designSpec.cta, 30);
  
  // Fallback a foto de producto por defecto
  const productImg = assetUrl || 'https://chilaquiles-top.web.app/assets/hero_transparent-04-7IXms.png';
  
  let width = 1080;
  let height = 1080;
  if (format === 'instagram_story' || format === 'reel_cover') height = 1920;

  // Render HTML basado en formato
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;900&display=swap" rel="stylesheet">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          width: ${width}px;
          height: ${height}px;
          background: linear-gradient(135deg, #0000FF 0%, #000080 100%);
          color: white;
          font-family: 'Montserrat', sans-serif;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          padding: 80px;
        }
        
        /* Círculos de fondo para decoración */
        .bg-circle {
          position: absolute;
          border-radius: 50%;
          background: rgba(255, 107, 0, 0.1);
        }
        .circle-1 { width: 800px; height: 800px; top: -200px; right: -200px; }
        .circle-2 { width: 600px; height: 600px; bottom: -100px; left: -200px; background: rgba(217, 4, 41, 0.1); }

        .logo {
          font-size: 36px;
          font-weight: 900;
          color: #FF6B00;
          margin-bottom: 40px;
          z-index: 10;
        }

        .content {
          z-index: 10;
          max-width: 65%;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .headline {
          font-size: ${format === 'instagram_story' ? '80px' : '70px'};
          font-weight: 900;
          line-height: 1.1;
          text-transform: uppercase;
        }

        .subheadline {
          font-size: 32px;
          font-weight: 400;
          color: rgba(255, 255, 255, 0.9);
          margin-bottom: 30px;
        }

        .price-tag {
          background: #D90429;
          color: white;
          padding: 15px 40px;
          border-radius: 50px;
          font-size: 48px;
          font-weight: 900;
          display: inline-block;
          align-self: flex-start;
          box-shadow: 0 10px 20px rgba(217, 4, 41, 0.4);
        }

        .product-image {
          position: absolute;
          right: -50px;
          bottom: ${format === 'instagram_story' ? '200px' : '-50px'};
          width: ${format === 'instagram_story' ? '900px' : '700px'};
          z-index: 5;
          filter: drop-shadow(0 20px 30px rgba(0,0,0,0.5));
        }

        .cta {
          position: absolute;
          bottom: 80px;
          left: 80px;
          background: #FF6B00;
          color: white;
          padding: 20px 50px;
          border-radius: 15px;
          font-size: 30px;
          font-weight: 700;
          z-index: 10;
          box-shadow: 0 10px 20px rgba(255, 107, 0, 0.4);
        }

        /* Layout específico para historias */
        ${format === 'instagram_story' ? \`
          body { padding: 120px 80px; justify-content: flex-start; }
          .content { max-width: 100%; text-align: center; align-items: center; }
          .product-image { right: auto; left: 50%; transform: translateX(-50%); bottom: 300px; width: 850px; }
          .cta { left: 50%; bottom: 120px; transform: translateX(-50%); width: 80%; text-align: center; }
        \` : ''}

        /* WhatsApp: Texto más grande al centro */
        ${format === 'whatsapp_image' ? \`
          .content { max-width: 100%; text-align: center; align-items: center; margin-top: 50px; }
          .product-image { right: auto; left: 50%; transform: translateX(-50%); bottom: 150px; width: 600px; }
          .cta { left: 50%; bottom: 40px; transform: translateX(-50%); }
          .price-tag { margin-top: 20px; }
        \` : ''}
      </style>
    </head>
    <body>
      <div class="bg-circle circle-1"></div>
      <div class="bg-circle circle-2"></div>
      
      <div class="logo">CHILAQUILES TOP</div>
      
      <div class="content">
        <h1 class="headline">${headline}</h1>
        <p class="subheadline">${subheadline}</p>
        <div class="price-tag">${price}</div>
      </div>

      <img src="${productImg}" class="product-image" alt="Producto">
      
      <div class="cta">${cta}</div>
    </body>
    </html>
  `;
};

// Generar Screenshot y Optimizar
export const renderHtmlToPng = async (designSpec, assetUrl) => {
  const html = getTemplateHTML(designSpec, assetUrl);
  
  const width = designSpec.width || 1080;
  const height = designSpec.height || 1080;

  // Windows vs Linux executable path
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || 
    (process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : '/usr/bin/google-chrome-stable');

  const browser = await puppeteer.launch({
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    headless: 'new'
  });

  const page = await browser.newPage();
  await page.setViewport({ width, height });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  
  const screenshotBuffer = await page.screenshot({ type: 'png' });
  await browser.close();

  // Optimizar con Sharp
  const optimizedBuffer = await sharp(screenshotBuffer)
    .png({ quality: 85, compressionLevel: 9 })
    .toBuffer();

  return {
    buffer: optimizedBuffer,
    htmlSnapshot: html
  };
};
