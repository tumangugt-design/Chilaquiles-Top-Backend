import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COMPONENTS_DIR = path.join(__dirname, 'components');

const extractComponents = (filePath, prefix) => {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Split by the separator comments used in the HTML files
  const blocks = content.split(/<!--\s*================={2,}[\s\S]*?================={2,}\s*-->/);
  
  const components = {};
  
  // Skip the first block which is usually the file header comment
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].trim();
    if (!block) continue;
    
    // Attempt to parse the class name to use as ID (e.g. .ct-header--1 or ct-bg--1)
    const match = block.match(/class="[^"]*(ct-[a-z0-9-]+)[^"]*"/);
    const id = match ? match[1] : `${prefix}-${i}`;
    
    components[id] = block;
  }
  
  return components;
};

export const ComponentRegistry = {
  headers: extractComponents(path.join(COMPONENTS_DIR, 'ct-headers.html'), 'ct-header'),
  footers: extractComponents(path.join(COMPONENTS_DIR, 'ct-footers.html'), 'ct-footer'),
  backgrounds: extractComponents(path.join(COMPONENTS_DIR, 'ct-backgrounds.html'), 'ct-bg'),
  tokens: fs.existsSync(path.join(COMPONENTS_DIR, 'ct-tokens.css')) 
    ? fs.readFileSync(path.join(COMPONENTS_DIR, 'ct-tokens.css'), 'utf-8') 
    : ''
};

export const getComponent = (category, id) => {
  if (ComponentRegistry[category] && ComponentRegistry[category][id]) {
    return ComponentRegistry[category][id];
  }
  return null;
};
