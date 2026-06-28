import { ContentDraft } from '../models/ContentDraft.model.js';
import { publishToFacebook, publishToInstagram } from '../services/publish.service.js';

export const publishDraft = async (req, res) => {
  try {
    const { id } = req.params;
    const { platforms } = req.body; // e.g. ['facebook', 'instagram']

    const draft = await ContentDraft.findById(id);
    if (!draft) {
      return res.status(404).json({ error: 'Borrador no encontrado' });
    }

    if (!draft.visual?.imageUrl || draft.visual.imageUrl.startsWith('data:')) {
      return res.status(400).json({ error: 'El arte no tiene una URL pública válida en Firebase' });
    }

    const imageUrl = draft.visual.imageUrl;
    const isHistoria = draft.formats?.includes('historia');
    
    // Obtener texto del copy dependiendo del formato
    const caption = draft.copy?.post || draft.copy?.story || draft.copy?.caption || draft.title;

    const results = [];
    const errors = [];

    // Validar en qué plataformas publicar
    const targetPlatforms = platforms || draft.platforms || [];

    for (const platform of targetPlatforms) {
      try {
        if (platform === 'facebook') {
          const fbRes = await publishToFacebook(imageUrl, caption);
          results.push({ platform: 'facebook', id: fbRes.id });
        } else if (platform === 'instagram') {
          const igRes = await publishToInstagram(imageUrl, caption, isHistoria);
          results.push({ platform: 'instagram', id: igRes.id });
        }
      } catch (err) {
        errors.push({ platform, error: err.message });
      }
    }

    if (results.length > 0) {
      draft.status = 'published';
      draft.publishedAt = new Date();
      // Registrar dónde se publicó
      results.forEach(res => {
        if (!draft.platforms?.includes(res.platform)) {
          if (!draft.platforms) draft.platforms = [];
          draft.platforms.push(res.platform);
        }
      });
      await draft.save();
    }

    return res.status(200).json({
      success: true,
      results,
      errors,
      draft
    });

  } catch (error) {
    console.error('[Publish Controller] Error al publicar:', error);
    return res.status(500).json({ error: 'Error interno del servidor al publicar' });
  }
};
