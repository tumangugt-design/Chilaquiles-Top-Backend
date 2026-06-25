import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveAsset, AssetCatalog } from '../config/asset.catalog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Construye el SVG completo a partir del DesignSpec devuelto por la IA.
 */
export const buildSvgFromSpec = (spec) => {
  const {
    copy = {},
    width = 1080,
    height = 1080,
    objects = [],
    selectedComponents = {}
  } = spec;

  const bgClass = selectedComponents.background || 'ct-bg--1';
  const hasDark = bgClass === 'ct-bg--2';

  // Colores de marca
  const CT_AZUL = '#1B3FAB';
  const CT_NARANJA = '#FF6B00';
  const CT_VERDE = '#25D366';
  const CT_NEGRO = '#0B0B12';
  const bgColor = hasDark ? CT_NEGRO : '#F5F5F0';
  const textColor = hasDark ? '#FFFFFF' : CT_NEGRO;

  // Headline
  const headline = copy.headline || 'CHILAQUILES TOP';
  const subheadline = copy.subheadline || '';
  const price = copy.price || '';
  const cta = copy.cta || '';
  const badge = copy.badge || '';

  const fontSize = headline.length > 20 ? 70 : 90;
  const headlineY = price ? 320 : 400;

  let svgParts = [];

  // Fondo
  svgParts.push(`<rect width="${width}" height="${height}" fill="${bgColor}" />`);

  // Decoración de fondo (círculo grande)
  svgParts.push(`<circle cx="${width * 0.85}" cy="${height * 0.2}" r="320" fill="${CT_AZUL}" opacity="0.08" />`);
  svgParts.push(`<circle cx="${width * 0.1}" cy="${height * 0.85}" r="200" fill="${CT_NARANJA}" opacity="0.07" />`);

  // Barra superior de marca
  svgParts.push(`<rect x="0" y="0" width="${width}" height="90" fill="${CT_AZUL}" />`);
  svgParts.push(`<text x="${width / 2}" y="60" font-family="Arial Black, Arial, sans-serif" font-size="36" font-weight="900" fill="#FFFFFF" text-anchor="middle" letter-spacing="4">CHILAQUILES TOP</text>`);

  // Badge
  if (badge) {
    svgParts.push(`
      <rect x="${width / 2 - 200}" y="115" width="400" height="55" rx="27" fill="${CT_NARANJA}" />
      <text x="${width / 2}" y="151" font-family="Arial Black, Arial, sans-serif" font-size="22" font-weight="900" fill="#FFFFFF" text-anchor="middle" letter-spacing="2">${badge}</text>
    `);
  }

  // Headline
  svgParts.push(`
    <text x="${width / 2}" y="${headlineY}" font-family="Arial Black, Arial, sans-serif" font-size="${fontSize}" font-weight="900" fill="${price ? CT_NARANJA : CT_AZUL}" text-anchor="middle" letter-spacing="-1">${headline}</text>
  `);

  // Subheadline
  if (subheadline) {
    svgParts.push(`
      <text x="${width / 2}" y="${headlineY + fontSize + 20}" font-family="Arial, sans-serif" font-size="32" font-weight="600" fill="${textColor}" text-anchor="middle" opacity="0.85">${subheadline}</text>
    `);
  }

  // Círculo de precio
  if (price) {
    const cx = width - 160;
    const cy = height / 2;
    svgParts.push(`
      <circle cx="${cx}" cy="${cy}" r="130" fill="${CT_AZUL}" />
      <text x="${cx}" y="${cy + 20}" font-family="Arial Black, Arial, sans-serif" font-size="52" font-weight="900" fill="#FFFFFF" text-anchor="middle">${price}</text>
    `);
    if (copy.validUntil) {
      svgParts.push(`<text x="${cx}" y="${cy + 52}" font-family="Arial, sans-serif" font-size="16" fill="#FFFFFF" text-anchor="middle" opacity="0.85">hasta ${copy.validUntil}</text>`);
    }
  }

  // Línea divisoria decorativa
  svgParts.push(`<rect x="${width / 2 - 60}" y="${height - 200}" width="120" height="5" rx="3" fill="${CT_NARANJA}" />`);

  // CTA Button
  if (cta) {
    svgParts.push(`
      <rect x="${width / 2 - 220}" y="${height - 175}" width="440" height="80" rx="40" fill="${CT_VERDE}" />
      <text x="${width / 2}" y="${height - 124}" font-family="Arial Black, Arial, sans-serif" font-size="28" font-weight="900" fill="#FFFFFF" text-anchor="middle">${cta}</text>
    `);
  }

  // Barra inferior
  svgParts.push(`<rect x="0" y="${height - 70}" width="${width}" height="70" fill="${CT_AZUL}" />`);
  svgParts.push(`<text x="${width / 2}" y="${height - 28}" font-family="Arial, sans-serif" font-size="22" fill="#FFFFFF" text-anchor="middle" opacity="0.9">Villa Nueva, Guatemala · WhatsApp: Pide ya 🌶️</text>`);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  ${svgParts.join('\n  ')}
</svg>`;
};

/**
 * Renderiza el spec a PNG usando sharp (sin Puppeteer, sin Chrome)
 */
export const renderImageFromSpec = async (spec) => {
  const svg = buildSvgFromSpec(spec);
  const buffer = Buffer.from(svg);

  const png = await sharp(buffer)
    .png()
    .toBuffer();

  return png;
};