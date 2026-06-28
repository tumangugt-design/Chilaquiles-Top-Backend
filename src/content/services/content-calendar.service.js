import { ContentCalendar } from '../models/ContentCalendar.model.js';
import { ContentDraft } from '../models/ContentDraft.model.js';
import { publishToFacebook, publishToInstagram } from './publish.service.js';

export const schedulePublication = async (draftId, platform, format, scheduledAt) => {
  const draft = await ContentDraft.findById(draftId);
  if (!draft) throw new Error('Borrador no encontrado');
  if (draft.status === 'draft' || draft.status === 'needs_review') {
    throw new Error('No se puede programar un borrador que no está aprobado');
  }
  if (!draft.visual?.imageUrl) {
    throw new Error('El arte falló al generarse (Sin Imagen). No se puede programar.');
  }

  const cal = new ContentCalendar({
    contentDraftId: draftId,
    platform,
    format,
    scheduledAt,
    status: 'pending'
  });

  draft.status = 'scheduled';
  await draft.save();
  await cal.save();
  return cal;
};

export const runScheduler = async () => {
  console.log('[Content Scheduler] Buscando publicaciones pendientes...');
  const now = new Date();
  
  const pending = await ContentCalendar.find({
    status: 'pending',
    scheduledAt: { $lte: now }
  }).populate('contentDraftId');

  for (const item of pending) {
    if (!item.contentDraftId || item.contentDraftId.status !== 'scheduled' && item.contentDraftId.status !== 'approved') {
      item.status = 'failed';
      item.error = 'Borrador asociado no válido o no aprobado';
      await item.save();
      continue;
    }

    item.status = 'processing';
    await item.save();

    try {
      const draft = item.contentDraftId;
      const imageUrl = draft.visual?.imageUrl;
      const caption = draft.copy?.post || draft.copy?.story || draft.copy?.caption || draft.title;
      const isHistoria = item.format === 'historia' || draft.formats?.includes('historia');

      if (item.platform === 'facebook') {
        await publishToFacebook(imageUrl, caption);
      } else if (item.platform === 'instagram') {
        await publishToInstagram(imageUrl, caption, isHistoria);
      }

      item.status = 'published';
      
      item.contentDraftId.status = 'published';
      item.contentDraftId.publishedAt = new Date();
      await item.contentDraftId.save();
    } catch (e) {
      item.status = 'failed';
      item.error = e.message;
      item.contentDraftId.status = 'failed';
      await item.contentDraftId.save();
    }
    await item.save();
  }

  console.log(`[Content Scheduler] Procesadas ${pending.length} publicaciones.`);
  return { processed: pending.length };
};
