import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

// This MVP uses a simple SVG template converted to an image via sharp.
// In a real scenario, this would use BrandKnowledge assets, proper fonts, and background images.

export const renderTemplate = async (visualBrief, outputPath) => {
  const { headline, subheadline, priceText, ctaText } = visualBrief;

  const width = 1080;
  const height = 1080;

  const svgImage = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#FF5E3A;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#FF2A6D;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#grad)" />
      
      <text x="50%" y="20%" font-family="sans-serif" font-size="80" font-weight="bold" fill="white" text-anchor="middle">
        ${headline || 'Chilaquiles Top'}
      </text>
      
      <text x="50%" y="40%" font-family="sans-serif" font-size="50" fill="white" text-anchor="middle">
        ${subheadline || 'Deliciosos y frescos'}
      </text>

      <rect x="35%" y="55%" width="30%" height="10%" rx="20" fill="white" />
      <text x="50%" y="62%" font-family="sans-serif" font-size="60" font-weight="bold" fill="#FF2A6D" text-anchor="middle">
        ${priceText || 'Q55'}
      </text>

      <rect x="30%" y="80%" width="40%" height="8%" rx="10" fill="black" />
      <text x="50%" y="85.5%" font-family="sans-serif" font-size="40" font-weight="bold" fill="white" text-anchor="middle">
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
