import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

// This MVP uses a simple SVG template converted to an image via sharp.
// It uses Chilaquiles Top brand colors: Blue (#0000FF), White (#FFFFFF), Black (#000000), Red (#D90429)

export const renderTemplate = async (visualBrief, outputPath) => {
  const { headline, subheadline, priceText, ctaText } = visualBrief;

  const width = 1080;
  const height = 1080;

  const svgImage = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#0000FF;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#000080;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#grad)" />
      
      <text x="50%" y="25%" font-family="Montserrat, sans-serif" font-size="90" font-weight="900" fill="#FFFFFF" text-anchor="middle">
        ${headline || 'CHILAQUILES TOP'}
      </text>
      
      <text x="50%" y="40%" font-family="Montserrat, sans-serif" font-size="50" font-weight="600" fill="#FFFFFF" text-anchor="middle">
        ${subheadline || 'Los mejores de Villa Nueva'}
      </text>

      <rect x="35%" y="52%" width="30%" height="12%" rx="20" fill="#FFFFFF" />
      <text x="50%" y="60.5%" font-family="Montserrat, sans-serif" font-size="70" font-weight="900" fill="#D90429" text-anchor="middle">
        ${priceText || 'Q55'}
      </text>

      <rect x="30%" y="80%" width="40%" height="8%" rx="40" fill="#FF6B00" />
      <text x="50%" y="85.5%" font-family="Montserrat, sans-serif" font-size="40" font-weight="900" fill="#FFFFFF" text-anchor="middle">
        ${ctaText || 'PIDE AHORA'}
      </text>
    </svg>
  `;

  const buffer = Buffer.from(svgImage);
  
  await sharp(buffer)
    .png()
    .toFile(outputPath);

  return outputPath;
};
