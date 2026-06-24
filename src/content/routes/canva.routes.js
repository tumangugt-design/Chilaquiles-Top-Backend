import express from 'express';
import { generateCanvaAuthUrl, handleCanvaCallback, getValidAccessToken, getTemplateDataset, createDesignFromTemplate, exportDesign } from '../services/canva.service.js';
import { verifyAuthToken } from '../../middlewares/auth.middleware.js';
import { requireRole } from '../../middlewares/role.middleware.js';
import { IntegrationToken } from '../models/IntegrationToken.model.js';

const router = express.Router();

router.get('/auth', verifyAuthToken, requireRole(['ADMIN']), (req, res) => {
  try {
    const authUrl = generateCanvaAuthUrl();
    res.json({ success: true, url: authUrl });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) {
      return res.status(400).send('Faltan parámetros code o state');
    }
    
    await handleCanvaCallback(code, state);
    
    // Redirect back to Admin panel
    const frontendUrl = process.env.VITE_FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/admin?tab=content_studio&canva=success`);
  } catch (error) {
    console.error('Canva Callback Error:', error);
    res.status(500).send(`Error en autorización Canva: ${error.message}`);
  }
});

router.get('/status', verifyAuthToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const token = await IntegrationToken.findOne({ provider: 'canva' });
    res.json({ success: true, connected: !!token });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Endpoint for Minimal Technical Test
router.post('/test', verifyAuthToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { templateId, dataMap } = req.body; // e.g. { headline: 'Test', price: 'Q100' }
    
    // 1. Dataset Check
    const dataset = await getTemplateDataset(templateId);
    
    // 2. Autofill
    const designResult = await createDesignFromTemplate(templateId, dataMap);
    
    // 3. Export
    const exportUrls = await exportDesign(designResult.designId, 'png');
    
    res.json({
      success: true,
      dataset,
      designId: designResult.designId,
      designUrl: designResult.designUrl,
      exports: exportUrls
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
