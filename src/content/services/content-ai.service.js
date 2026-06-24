import { getAICompletion } from '../../bot/ai.service.js';
import { BrandKnowledge } from '../models/BrandKnowledge.model.js';
import { ContentStandard } from '../models/ContentStandard.model.js';

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
