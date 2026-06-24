import crypto from 'crypto';
import fetch from 'node-fetch';
import { encryptText, decryptText } from './crypto.service.js';
import { IntegrationToken } from '../models/IntegrationToken.model.js';

// En memoria, mapea "state" a "code_verifier" para el flujo PKCE
const pkceStore = new Map();

export const generateCanvaAuthUrl = () => {
  const clientId = process.env.CANVA_CLIENT_ID;
  const redirectUri = process.env.CANVA_REDIRECT_URI;
  
  if (!clientId || !redirectUri) {
    throw new Error('Canva Client ID and Redirect URI are not configured');
  }

  // 1. Generate code verifier and challenge
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  
  // 2. Generate state
  const state = crypto.randomBytes(16).toString('hex');
  
  // Store verifier for the callback
  pkceStore.set(state, codeVerifier);

  // 3. Build Auth URL
  const scopes = [
    'design:content:read',
    'design:content:write',
    'design:meta:read',
    'brandtemplate:meta:read',
    'brandtemplate:content:read',
    'asset:read',
    'asset:write'
  ].join(' ');

  const authUrl = new URL('https://www.canva.com/api/oauth/authorize');
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('client_id', clientId);
  authUrl.searchParams.append('redirect_uri', redirectUri);
  authUrl.searchParams.append('scope', scopes);
  authUrl.searchParams.append('state', state);
  authUrl.searchParams.append('code_challenge', codeChallenge);
  authUrl.searchParams.append('code_challenge_method', 'S256');

  return authUrl.toString();
};

export const handleCanvaCallback = async (code, state) => {
  const clientId = process.env.CANVA_CLIENT_ID;
  const clientSecret = process.env.CANVA_CLIENT_SECRET;
  const redirectUri = process.env.CANVA_REDIRECT_URI;

  const codeVerifier = pkceStore.get(state);
  if (!codeVerifier) {
    throw new Error('Invalid state or expired session');
  }

  // Remove from store
  pkceStore.delete(state);

  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  
  const response = await fetch('https://api.canva.com/rest/v1/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${authHeader}`
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
      code,
      redirect_uri: redirectUri
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Canva OAuth Error: ${data.error_description || data.error}`);
  }

  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  // Save to DB
  await IntegrationToken.findOneAndUpdate(
    { provider: 'canva' },
    {
      accessToken: encryptText(data.access_token),
      refreshToken: encryptText(data.refresh_token),
      expiresAt,
      updatedAt: new Date()
    },
    { upsert: true, new: true }
  );

  return true;
};

// --- Canva API Logic ---

export const getValidAccessToken = async () => {
  const tokenDoc = await IntegrationToken.findOne({ provider: 'canva' });
  if (!tokenDoc) {
    throw new Error('Canva is not connected');
  }

  // Check if expired
  if (tokenDoc.expiresAt < new Date()) {
    const clientId = process.env.CANVA_CLIENT_ID;
    const clientSecret = process.env.CANVA_CLIENT_SECRET;
    const refreshToken = decryptText(tokenDoc.refreshToken);
    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await fetch('https://api.canva.com/rest/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${authHeader}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error('Failed to refresh Canva token');
    }

    tokenDoc.accessToken = encryptText(data.access_token);
    tokenDoc.refreshToken = encryptText(data.refresh_token);
    tokenDoc.expiresAt = new Date(Date.now() + data.expires_in * 1000);
    tokenDoc.updatedAt = new Date();
    await tokenDoc.save();
  }

  return decryptText(tokenDoc.accessToken);
};

export const getTemplateDataset = async (templateId) => {
  const token = await getValidAccessToken();
  const res = await fetch(`https://api.canva.com/rest/v1/brand-templates/${templateId}/dataset`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Canva Dataset Error: ${err}`);
  }
  return res.json();
};

export const createDesignFromTemplate = async (templateId, dataMap) => {
  const token = await getValidAccessToken();

  // dataMap: { headline: '...', price: 'Q55' }
  const dataPayload = {};
  for (const [key, value] of Object.entries(dataMap)) {
    if (value) {
      dataPayload[key] = { type: 'text', text: value };
    }
  }

  const payload = {
    type: 'create_from_brand_template',
    brand_template_id: templateId,
    data: dataPayload
  };

  const res = await fetch('https://api.canva.com/rest/v1/autofills', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Autofill Start Error: ${JSON.stringify(data)}`);

  const jobId = data.job.id;
  
  // Polling
  let jobStatus = data.job.status;
  let finalData = data.job;

  while (jobStatus === 'in_progress') {
    await new Promise(r => setTimeout(r, 2000));
    const pollRes = await fetch(`https://api.canva.com/rest/v1/autofills/${jobId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const pollData = await pollRes.json();
    jobStatus = pollData.job.status;
    finalData = pollData.job;
  }

  if (jobStatus !== 'success') {
    throw new Error(`Autofill Job Failed: ${JSON.stringify(finalData)}`);
  }

  return {
    designId: finalData.result.design.id,
    designUrl: finalData.result.design.url
  };
};

export const exportDesign = async (designId, format = 'png') => {
  const token = await getValidAccessToken();
  
  const payload = {
    design_id: designId,
    format: { type: format } // e.g. "png" or "jpg"
  };

  const res = await fetch('https://api.canva.com/rest/v1/exports', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Export Start Error: ${JSON.stringify(data)}`);

  const jobId = data.job.id;
  let jobStatus = data.job.status;
  let finalData = data.job;

  while (jobStatus === 'in_progress') {
    await new Promise(r => setTimeout(r, 2000));
    const pollRes = await fetch(`https://api.canva.com/rest/v1/exports/${jobId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const pollData = await pollRes.json();
    jobStatus = pollData.job.status;
    finalData = pollData.job;
  }

  if (jobStatus !== 'success') {
    throw new Error(`Export Job Failed: ${JSON.stringify(finalData)}`);
  }

  // Return the array of downloaded URLs (usually finalData.urls contains the image urls)
  return finalData.urls;
};
