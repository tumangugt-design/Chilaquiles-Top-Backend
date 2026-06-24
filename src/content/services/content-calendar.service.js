import { ContentCalendar } from '../models/ContentCalendar.model.js';
import { ContentDraft } from '../models/ContentDraft.model.js';
import { publishToMeta } from './meta.service.js';

export const schedulePublication = async (draftId, platform, format, scheduledAt) => {
  const draft = await ContentDraft.findById(draftId);
  if (!draft) throw new Error('Borrador no encontrado');
  if (draft.status === 'draft' || draft.status === 'needs_review') {
    throw new Error('No se puede programar un borrador que no está aprobado');
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
      await publishToMeta(item.contentDraftId, item.platform, item.format);
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
