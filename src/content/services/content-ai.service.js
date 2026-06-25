import { getAICompletion } from '../../bot/ai.service.js';
import { BrandKnowledge } from '../models/BrandKnowledge.model.js';
import { ContentStandard } from '../models/ContentStandard.model.js';
import { buildDesignSpecPrompt } from '../config/brand.config.js';

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

  const systemPrompt = `Eres un estratega experto de contenido y copywriter para "Chilaquiles TOP", restaurante en Villa Nueva, Guatemala.
Tu objetivo es generar un JSON con el contenido para publicar en redes sociales.

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
    const aiResponse = await getAICompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]);

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

/**
 * Genera el DesignSpec JSON — instrucciones para el motor de render.
 * La IA elige componentes HTML, copia persuasiva y objetos visuales.
 */
export const generateDesignSpecWithAI = async (requestData) => {
  const prompt = buildDesignSpecPrompt(requestData);

  console.log('[Content AI] Generating DesignSpec with AI Art Director...');

  try {
    const aiResponse = await getAICompletion([
      { role: 'user', content: prompt }
    ], {
      response_format: { type: 'json_object' }
    });

    if (!aiResponse || typeof aiResponse !== 'string') {
      throw new Error('AI returned empty or non-string response');
    }

    // Limpieza agresiva: quitar markdown, comentarios JS (// ...) y /* ... */
    let clean = aiResponse
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .replace(/\/\/[^\n]*/g, '')     // quita comentarios de línea
      .replace(/\/\*[\s\S]*?\*\//g, '') // quita comentarios de bloque
      .trim();

    // Si la respuesta empieza con texto antes del JSON, intentar extraer el JSON
    const jsonStart = clean.indexOf('{');
    const jsonEnd = clean.lastIndexOf('}');
    if (jsonStart > 0) {
      clean = clean.substring(jsonStart, jsonEnd + 1);
    }

    const spec = JSON.parse(clean);

    // Validaciones de seguridad
    if (!spec.selectedComponents) {
      spec.selectedComponents = { background: 'ct-bg--1', header: 'ct-header--1', footer: 'ct-footer--1' };
    }
    if (!spec.copy) {
      spec.copy = { badge: '', headline: 'CHILAQUILES TOP', subheadline: '', price: '', cta: 'ORDENA EN NUESTRA PÁGINA' };
    }
    if (!spec.objects) spec.objects = [];

    // Si NO es promoción y NO hay includePlate, quitar todos los objetos de tipo product
    if (spec.type !== 'promocion' && !requestData.includePlate) {
      spec.objects = spec.objects.filter(o => o.type !== 'product');
    }

    console.log('[Content AI] DesignSpec generated OK. Components:', spec.selectedComponents);
    return spec;

  } catch (error) {
    console.error('[Content AI] Error generating DesignSpec:', error.message);

    // Fallback con spec básico para no romper el flujo
    const isPromo = !!requestData.promotionData;
    return {
      format: requestData.format || 'post',
      width: 1080,
      height: requestData.format === 'historia' ? 1920 : 1080,
      type: isPromo ? 'promocion' : 'comunicado',
      selectedComponents: {
        background: 'ct-bg--1',
        header: 'ct-header--1',
        footer: 'ct-footer--1'
      },
      copy: {
        badge: isPromo ? 'OFERTA LIMITADA' : 'CHILAQUILES TOP',
        headline: isPromo ? (requestData.promotionData?.name || 'OFERTA ESPECIAL').toUpperCase() : (requestData.topic || 'MANTENTE TOP').toUpperCase(),
        subheadline: isPromo ? 'Solo en Villa Nueva' : 'Los chilaquiles más top de Guatemala',
        price: isPromo ? `Q${requestData.promotionData?.price || ''}` : '',
        validUntil: '',
        cta: 'ORDENA EN NUESTRA PÁGINA'
      },
      objects: (isPromo || requestData.includePlate) ? [{
        id: 'hero_product',
        type: 'product',
        assetId: 'chilaquiles_2',
        role: 'hero',
        size: { width: 420 },
        effects: { shadow: 'plate' }
      }] : [],
      caption: {
        instagram: `¡${requestData.topic || 'Chilaquiles TOP'} ahora disponible! 🔥 #ChilaquilesTop #MantenteTOP`,
        facebook: `Ahora disponible en Villa Nueva. Ordena en chilaquilestop.com`,
        whatsapp: `¡Hola! Quiero pedir: ${requestData.topic || 'Chilaquiles TOP'}. Ver menú en chilaquilestop.com`
      },
      hashtags: ['#ChilaquilesTop', '#MantenteTOP', '#VillaNueva', '#Guatemala']
    };
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
