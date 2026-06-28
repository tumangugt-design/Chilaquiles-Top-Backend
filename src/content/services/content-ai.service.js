import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getClaudeCompletion } from './claude.service.js';
import { BrandKnowledge } from '../models/BrandKnowledge.model.js';
import { ContentStandard } from '../models/ContentStandard.model.js';
import { AssetCatalog, resolveAsset } from '../config/asset.catalog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Helper para leer los nuevos templates HTML
 */
const readTemplate = (filename) => {
  try {
    return fs.readFileSync(path.join(__dirname, '../templates', filename), 'utf-8');
  } catch (e) {
    console.error(`[Content AI] No se pudo leer template ${filename}:`, e.message);
    throw e;
  }
};

/**
 * Lee la guía ct-composing-guide.md
 */
const readGuide = () => {
  try {
    return fs.readFileSync(path.join(__dirname, '../ct-composing-guide.md'), 'utf-8');
  } catch (e) {
    console.error(`[Content AI] No se pudo leer la guía:`, e.message);
    return 'Eres el generador de contenido visual de Chilaquiles TOP.';
  }
};

/**
 * Genera el contenido textual (copy, caption, hashtags) para la publicación.
 * Devuelve un JSON con copy + designSpec básico.
 */
export const generateContentFromIdea = async (ideaData) => {
  const { topic, objective, platforms, formats, tone, promotionData } = ideaData;

  const rules = await BrandKnowledge.find({ status: 'active' });
  const standards = await ContentStandard.find({ active: true });

  const rulesText = rules.map(r => `- [${r.type}] ${r.content}`).join('\n') || '(Sin reglas adicionales)';
  const standardsText = standards.map(s => `- [Estándar: ${s.scope}] ${s.value}`).join('\n') || '(Sin estándares)';

  const systemPrompt = `Eres un profesional experto en marketing, redes sociales, edición y renderización de HTML para artes gráficos de "Chilaquiles TOP", restaurante en Villa Nueva, Guatemala.
Tu objetivo es analizar la idea y generar un JSON con el contenido exacto y persuasivo para publicar en redes sociales.

Reglas del negocio:
- Solo entregamos en Villa Nueva.
- No inventes promociones que no te pasemos.
- No inventes precios ni horarios.
- El tono debe ser: ${tone || 'antojable, claro, juvenil y confiable'}.
- Todo el copy debe estar en ESPAÑOL correcto, sin anglicismos.
- El CTA siempre refiere a la página web: chilaquilestop.com

Base de Conocimiento de Marca:
${rulesText}

Estándares aprendidos:
${standardsText}

Formato de salida REQUERIDO (JSON puro, sin markdown ni explicaciones):
{
  "title": "Título interno corto",
  "objective": "sales",
  "platforms": ["instagram", "facebook"],
  "formats": ["post"],
  "copy": {
    "main": "Texto principal de la publicación",
    "short": "Texto corto para historias",
    "caption": "Caption para red social",
    "hashtags": ["#ChilaquilesTop", "#MantenteTOP"],
    "cta": "Ordena en chilaquilestop.com",
    "whatsappText": "Texto para WhatsApp"
  }
}`;

  let userPrompt = `Objetivo: ${objective || 'sales'}\nPlataformas: ${(platforms || ['instagram']).join(', ')}\nTema: ${topic || 'publicación de marca'}\n`;

  if (promotionData) {
    userPrompt += `\nPromoción: ${promotionData.name} — ${promotionData.description || ''} — Precio: Q${promotionData.price}\n`;
  }

  try {
    const aiResponse = await getClaudeCompletion(
      systemPrompt,
      userPrompt,
      true, // isJson
      0.7   // temperature
    );

    const cleanJson = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    const resultJson = JSON.parse(cleanJson);
    return { success: true, data: resultJson, rawContext: { rules: rules.length, standards: standards.length } };
  } catch (error) {
    console.error('[Content AI] Error in generateContentFromIdea:', error);
    // Fallback mínimo para no romper el flujo
    return {
      success: false,
      data: {
        title: topic || 'Arte Chilaquiles TOP',
        objective: objective || 'sales',
        platforms: platforms || ['instagram'],
        formats: formats || ['post'],
        copy: {
          main: '',
          short: '',
          caption: '',
          hashtags: ['#ChilaquilesTop', '#MantenteTOP'],
          cta: 'Ordena en chilaquilestop.com',
          whatsappText: ''
        }
      },
      rawContext: {}
    };
  }
};

export const generateDesignSpecWithAI = async (requestData) => {
  const { topic, format, promotionData, includePlate, selectedPlate } = requestData;

  console.log('[Content AI] Generando HTML con Claude Art Director...');

  // 1. Determinar URL del plato si se requiere
  let plateUrl = '';
  if (includePlate) {
    if (!selectedPlate || selectedPlate === 'aleatorio') {
      const keys = Object.keys(AssetCatalog.products);
      const randomKey = keys[Math.floor(Math.random() * keys.length)];
      plateUrl = AssetCatalog.products[randomKey].url;
    } else {
      plateUrl = resolveAsset(selectedPlate);
    }
  }

  // 2. Determinar archivo de template basado en el request
  const isPost = format === 'post';
  const folder = isPost ? 'Posts' : 'Historias';
  let templateFilename = '';
  
  if (includePlate) {
    templateFilename = isPost ? 'ct-post-promo.html' : 'ct-story-promo.html';
  } else {
    templateFilename = isPost ? 'ct-post-texto.html' : 'ct-story-texto.html';
  }

  const templateHtml = readTemplate(`${folder}/${templateFilename}`);
  const systemPrompt = readGuide();

  // 3. Preparar User Prompt para inyectar a Claude
  let userPrompt = `A continuación tienes la solicitud para el nuevo arte.
Formato seleccionado: ${format}
Tema: ${topic}
`;

  if (promotionData) {
    userPrompt += `Promoción: ${promotionData.name}
Descripción: ${promotionData.description}
Precio: ${promotionData.price}
Vigencia: ${promotionData.endDate || 'No especificada'}
`;
  }

  userPrompt += `
URLs CONSTANTES A UTILIZAR:
- LOGO_WORD_BLANCO: ${AssetCatalog.logos.logo_word_blanco.url}
- LOGO_WORD_AZUL: ${AssetCatalog.logos.logo_word_azul.url}
`;
  
  if (includePlate) {
    userPrompt += `- PLATE_URL: ${plateUrl}\n`;
  }

  userPrompt += `
TU TAREA:
Rellena el siguiente template HTML con las variables {{}} solicitadas, basándote en la información anterior y tu creatividad. 
DEVUELVE ÚNICAMENTE EL CÓDIGO HTML PURO, SIN EXPLICACIONES, SIN MARKDOWN (\`\`\`html).

TEMPLATE A UTILIZAR:
${templateHtml}
`;

  try {
    const aiResponse = await getClaudeCompletion(
      systemPrompt,
      userPrompt,
      false, // no es JSON, es HTML
      0.85   // Temperatura moderada alta para buena escritura
    );

    if (!aiResponse || typeof aiResponse !== 'string') {
      throw new Error('AI returned empty or non-string response');
    }

    // Limpieza agresiva de markdown
    const finalHtml = aiResponse
      .replace(/```html/gi, '')
      .replace(/```/g, '')
      .trim();

    return finalHtml;

  } catch (error) {
    console.error('[Content AI] Error generating DesignSpec:', error.message);
    throw error;
  }
};

export const detectNewStandard = async (userMessage) => {
  const systemPrompt = `Evalúa si el siguiente mensaje del usuario contiene una nueva instrucción o regla sobre cómo debe generarse el contenido, artes o copy de la marca.
Por ejemplo: "De ahora en adelante usa menos texto", "Nuevos márgenes más delgados", "Siempre incluye el precio".
Devuelve EXCLUSIVAMENTE un JSON con:
{
  "shouldSave": true,
  "type": "visual_rule",
  "rule": "La regla detectada",
  "scope": "layout"
}
O si no hay regla: {"shouldSave": false}`;

  try {
    const aiResponse = await getClaudeCompletion(
      systemPrompt,
      userMessage,
      true
    );
    const cleanJsonStr = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJsonStr);
  } catch (e) {
    return { shouldSave: false };
  }
};

export const generateCaptionForImage = async (imageBase64, promptText) => {
  const rules = await BrandKnowledge.find({ status: 'active' });
  const standards = await ContentStandard.find({ active: true });

  const rulesText = rules.map(r => `- [${r.type}] ${r.content}`).join('\n') || '(Sin reglas adicionales)';
  const standardsText = standards.map(s => `- [Estándar: ${s.scope}] ${s.value}`).join('\n') || '(Sin estándares)';

  const systemPrompt = `Eres un profesional experto en marketing, redes sociales y redacción creativa para "Chilaquiles TOP", restaurante en Villa Nueva, Guatemala.
Tu objetivo es analizar la foto adjunta y generar un JSON con el contenido exacto y persuasivo para publicarla en redes sociales.

Reglas del negocio:
- Solo entregamos en Villa Nueva.
- No inventes promociones ni precios.
- El tono debe ser antojable, claro, juvenil y confiable.
- Todo el copy debe estar en ESPAÑOL correcto, sin anglicismos.

Base de Conocimiento de Marca:
${rulesText}

Estándares aprendidos:
${standardsText}

Formato de salida REQUERIDO (JSON puro, sin markdown ni explicaciones):
{
  "title": "Título descriptivo de la foto",
  "copy": {
    "main": "Texto principal corto",
    "caption": "El caption perfecto y antojable describiendo lo que se ve en la foto",
    "hashtags": ["#ChilaquilesTop", "#VillaNueva"],
    "cta": "¡Pide los tuyos hoy!"
  }
}`;

  const userPrompt = promptText || "Analiza esta foto de nuestros chilaquiles y genera el texto para publicarla en nuestras redes sociales hoy.";

  try {
    const aiResponse = await getClaudeCompletion(
      systemPrompt,
      userPrompt,
      true, // isJson
      0.7,  // temperature
      imageBase64
    );

    const cleanJson = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    const resultJson = JSON.parse(cleanJson);
    return { success: true, data: resultJson };
  } catch (error) {
    console.error('[Content AI] Error in generateCaptionForImage:', error);
    throw new Error('No se pudo generar el texto para la imagen');
  }
};
