import { getAICompletion } from '../../bot/ai.service.js';
import { BrandKnowledge } from '../models/BrandKnowledge.model.js';
import { ContentStandard } from '../models/ContentStandard.model.js';
import { buildImagePrompt } from '../config/brand.config.js';

export const generateContentFromIdea = async (ideaData) => {
  const { topic, objective, platforms, formats, tone, promotionData } = ideaData;

  // 1. Fetch Brand Knowledge & Standards
  const rules = await BrandKnowledge.find({ status: 'active' });
  const standards = await ContentStandard.find({ active: true });

  const rulesText = rules.map(r => `- [${r.type}] ${r.content}`).join('\n');
  const standardsText = standards.map(s => `- [Estándar: ${s.scope}] ${s.value}`).join('\n');

  // 2. Build Prompt
  const systemPrompt = `Eres un estratega experto de contenido y copywriter para "Chilaquiles Top", una marca local de comida rápida (chilaquiles) en Villa Nueva, Guatemala.
Tu objetivo es generar un JSON estructurado con el contenido para publicar en redes.

Reglas del negocio:
- Solo entregamos en Villa Nueva.
- No inventes promociones que no te pasemos.
- No inventes precios ni horarios.
- El tono debe ser: ${tone || 'antojable, claro, juvenil y confiable'}.
- REGLA VISUAL OBLIGATORIA: Los colores del arte (en el tema/diseño) SIEMPRE deben ser los colores corporativos de Chilaquiles Top: Naranja Brillante, Azul Profundo, Blanco y detalles en Gris oscuro.

Base de Conocimiento de Marca:
${rulesText}

Estándares aprendidos (MUY IMPORTANTE respetarlos):
${standardsText}

Formato de salida REQUERIDO (JSON puro, sin markdown ni explicaciones):
{
  "title": "Un título interno corto",
  "objective": "sales o awareness",
  "platforms": ["instagram", "facebook"],
  "formats": ["feed", "story"],
  "copy": {
    "main": "El texto principal para la publicación",
    "short": "Texto corto para historias",
    "caption": "Caption para la red social",
    "hashtags": ["#chilaquiles", "#villanueva"],
    "cta": "Llamado a la acción",
    "whatsappText": "Texto adaptado para WhatsApp"
  },
  "designSpec": {
    "format": "instagram_feed",
    "width": 1080,
    "height": 1080,
    "layout": "promo_product_left",
    "headline": "TITULAR PRINCIPAL CORTA",
    "subheadline": "Texto secundario",
    "price": "Q00",
    "cta": "Llamado a la acción",
    "theme": "hot_promo"
  }
}`;

  let userPrompt = `Objetivo: ${objective}\nPlataformas: ${platforms.join(', ')}\nFormatos: ${formats.join(', ')}\n`;

  if (topic) {
    userPrompt += `Instrucciones adicionales del usuario: "${topic}"\n`;
  } else {
    userPrompt += `Instrucciones: Genera libremente una excelente publicación atractiva basada en los datos proporcionados.\n`;
  }

  if (promotionData) {
    userPrompt += `\nUsa esta promoción obligatoriamente para generar el contenido:\nNombre: ${promotionData.name}\nDescripción: ${promotionData.description}\nPrecio: Q${promotionData.price}\n`;
  }

  try {
    const aiResponse = await getAICompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]);

    // Parse JSON
    // Remove markdown code blocks if the AI returns them
    const cleanJsonStr = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    const resultJson = JSON.parse(cleanJsonStr);
    
    return {
      success: true,
      data: resultJson,
      rawContext: { rules: rules.length, standards: standards.length }
    };
  } catch (error) {
    console.error('Error in content generation AI:', error);
    throw new Error('Error al generar el contenido con IA');
  }
};

export const detectNewStandard = async (userMessage) => {
  const systemPrompt = `Evalúa si el siguiente mensaje del usuario contiene una nueva instrucción o regla sobre cómo debe generarse el contenido, artes o copy de la marca.
Por ejemplo: "De ahora en adelante usa menos texto", "Nuevos márgenes más delgados", "Siempre incluye el precio".
Devuelve EXCLUSIVAMENTE un JSON con:
{
  "shouldSave": true|false,
  "type": "visual_rule" | "copy_example" | "tone_rule",
  "rule": "La regla detectada",
  "scope": "layout" | "copy" | "brand"
}`;

  try {
    const aiResponse = await getAICompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ]);
    const cleanJsonStr = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJsonStr);
  } catch (e) {
    return { shouldSave: false };
  }
};

export const generateImageWithOpenRouter = async (promptText, designSpec = null, promotionData = null) => {
  const apiKey = process.env.OPEN_ROUTER_APIKEY;
  const imageModel = process.env.OPENROUTER_MODEL_IMAGES || 'google/gemini-3.1-flash-image';
  
  try {
    // Use brand-spec prompt builder if designSpec provided, otherwise use basic prompt
    const imagePrompt = buildImagePrompt(designSpec, promotionData) + 
      (promptText ? `\n\nADDITIONAL CONTEXT: ${promptText}` : '');

    console.log(`[OpenRouter] Generating image with model: ${imageModel}`);
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://chilaquilestop.com',
        'X-Title': 'Chilaquiles Top Backend',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: imageModel,
        messages: [{ role: 'user', content: imagePrompt }]
      })
    });

    const data = await response.json();
    console.log('[OpenRouter] Raw response status:', response.status);

    if (!data.choices || data.choices.length === 0) {
      console.error('[OpenRouter] No choices in response:', JSON.stringify(data).substring(0, 500));
      return null;
    }

    const message = data.choices[0].message;
    const content = message?.content;
    
    console.log('[OpenRouter] Content type:', typeof content, 'Is array:', Array.isArray(content));
    console.log('[OpenRouter] Message keys:', Object.keys(message || {}));

    // *** PRIMARY: Gemini image model returns image in message.images ***
    if (message?.images && Array.isArray(message.images) && message.images.length > 0) {
      const img = message.images[0];
      console.log('[OpenRouter] Found image in message.images, type:', img.type || 'unknown', 'keys:', Object.keys(img));
      // type: "image_url" -> img.image_url.url
      if (img.type === 'image_url' && img.image_url?.url) return img.image_url.url;
      // Direct url on the object
      if (img.url) return img.url;
      // base64 in b64_json
      if (img.b64_json) return `data:image/png;base64,${img.b64_json}`;
      // base64 in data
      if (img.data) return `data:${img.media_type || 'image/png'};base64,${img.data}`;
      // Could be a plain URL string
      if (typeof img === 'string') return img;
      console.error('[OpenRouter] Unknown image object format:', JSON.stringify(img).substring(0, 300));
    }

    // Case 1: content is an array (multimodal response with image parts)
    if (Array.isArray(content)) {
      for (const part of content) {
        if (part.type === 'image_url' && part.image_url?.url) {
          console.log('[OpenRouter] Found image_url part');
          return part.image_url.url;
        }
        if (part.type === 'image' && part.source?.data) {
          console.log('[OpenRouter] Found base64 image part');
          return `data:${part.source.media_type || 'image/png'};base64,${part.source.data}`;
        }
        if (part.type === 'text' && part.text) {
          const urlMatch = part.text.match(/https?:\/\/[^\s"'()]+/);
          if (urlMatch) return urlMatch[0];
        }
      }
    }

    // Case 2: content is a string
    if (typeof content === 'string' && content) {
      const mdMatch = content.match(/!\[.*?\]\((https?:\/\/.*?)\)/);
      if (mdMatch) return mdMatch[1];
      const httpMatch = content.match(/https?:\/\/[^\s"'()]+/);
      if (httpMatch) return httpMatch[0];
      if (content.startsWith('data:image')) return content;
    }

    console.error('[OpenRouter] Could not extract image. Full message:', JSON.stringify(message).substring(0, 500));
    return null;

  } catch (error) {
    console.error('[OpenRouter] Error generating image:', error.message);
    return null;
  }
};
