import { MetaPublishLog } from '../models/MetaPublishLog.model.js';

export const publishToMeta = async (draft, platform, format) => {
  const isDryRun = process.env.CONTENT_DRY_RUN !== 'false'; // default to true

  const payload = {
    message: draft.copy.main || draft.copy.caption,
    link: draft.visual?.imageUrl || 'https://pedidos.chilaquilestop.com',
    platforms: platform,
    format: format
  };

  if (isDryRun) {
    console.log(`[META DRY RUN] Simulando publicación en ${platform} (${format})`);
    console.log(`[META DRY RUN] Payload:`, payload);

    const log = new MetaPublishLog({
      contentDraftId: draft._id,
      platform,
      format,
      requestPayload: payload,
      responsePayload: { simulated: true, success: true },
      status: 'simulated'
    });
    await log.save();
    return { success: true, simulated: true };
  }

  // Si no es DryRun, requiere META_ACCESS_TOKEN
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) {
    throw new Error('No se encontró META_ACCESS_TOKEN. Abortando publicación real.');
  }

  // TODO: Integración real con Graph API usando axios
  // try { 
  //   const response = await axios.post('https://graph.facebook.com/...', payload);
  // }
  
  throw new Error('Publicación real no implementada en MVP. Utilice CONTENT_DRY_RUN=true');
};
