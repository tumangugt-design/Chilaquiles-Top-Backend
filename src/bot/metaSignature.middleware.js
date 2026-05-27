import crypto from 'crypto';

export const verifyMetaSignature = (req, res, next) => {
  const signature = req.headers['x-hub-signature-256'];

  if (!signature) {
    console.error('[Security] Webhook received without X-Hub-Signature-256 header.');
    return res.status(401).send('Unauthorized: Missing signature');
  }

  // Get the app secret from environment variables.
  // It handles both META_APP_SECRET and APP_SECRET for flexibility.
  const appSecret = process.env.META_APP_SECRET || process.env.APP_SECRET;

  if (!appSecret) {
    console.error('[Security] META_APP_SECRET is not configured in the environment.');
    // In production, we should reject if the secret is missing.
    return res.status(500).send('Server configuration error');
  }

  if (!req.rawBody) {
    console.error('[Security] req.rawBody is missing. Ensure express.json() is configured with verify callback.');
    return res.status(500).send('Server configuration error');
  }

  // Generate the expected hash using HMAC SHA-256 and the App Secret
  const expectedHash = crypto
    .createHmac('sha256', appSecret)
    .update(req.rawBody)
    .digest('hex');

  const expectedSignature = `sha256=${expectedHash}`;

  // Use a timing-safe equal comparison to prevent timing attacks
  const signatureBuffer = Buffer.from(signature);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedSignatureBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedSignatureBuffer)) {
    console.error(`[Security] Invalid webhook signature detected. Expected ${expectedSignature}, got ${signature}. Potential fake webhook attack blocked.`);
    return res.status(401).send('Unauthorized: Invalid signature');
  }

  // If signatures match, proceed to the next middleware/controller
  next();
};
