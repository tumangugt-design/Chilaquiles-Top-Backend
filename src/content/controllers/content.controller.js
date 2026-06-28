import { createDraftFromIdea, getDrafts, approveDraft, deleteDraft, createManualDraft, updateDraftCopy } from '../services/content.service.js';
import { runScheduler, schedulePublication } from '../services/content-calendar.service.js';

export const generateContent = async (req, res) => {
  try {
    const draft = await createDraftFromIdea(req.body, req.user?.userId);
    res.json({ success: true, draft });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const listDrafts = async (req, res) => {
  try {
    const drafts = await getDrafts();
    res.json({ success: true, drafts });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const approveContentDraft = async (req, res) => {
  try {
    const draft = await approveDraft(req.params.id, req.user?.userId);
    res.json({ success: true, draft });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const scheduleContent = async (req, res) => {
  try {
    const { platform, format, scheduledAt } = req.body;
    const cal = await schedulePublication(req.params.id, platform, format, scheduledAt);
    res.json({ success: true, calendar: cal });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const runContentScheduler = async (req, res) => {
  try {
    const result = await runScheduler();
    res.json({ success: true, result });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const deleteContentDraft = async (req, res) => {
  try {
    const draft = await deleteDraft(req.params.id);
    res.json({ success: true, draft });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const createManualContent = async (req, res) => {
  try {
    const { imageBase64, promptText } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ success: false, message: 'La imagen en base64 es obligatoria' });
    }
    const draft = await createManualDraft(imageBase64, promptText, req.user?.userId);
    res.json({ success: true, draft });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const updateContentCopy = async (req, res) => {
  try {
    const { id } = req.params;
    const { copy } = req.body;
    const draft = await updateDraftCopy(id, copy);
    res.json({ success: true, draft });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};
