import crypto from 'crypto';

// Recurrente delivers webhooks through Svix. Verification follows the Svix spec:
// signedContent = `${svix-id}.${svix-timestamp}.${rawBody}`
// expected = base64(HMAC-SHA256(base64Decode(secret without 'whsec_'), signedContent))
// svix-signature header can contain multiple space-separated "v1,<sig>" values.
export const verifyRecurrenteSignature = (req, res, next) => {
  const svixId = req.headers['svix-id'];
  const svixTimestamp = req.headers['svix-timestamp'];
  const svixSignature = req.headers['svix-signature'];

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.error('[Security] Recurrente webhook received without Svix signature headers.');
    return res.status(401).send('Unauthorized: Missing signature headers');
  }

  const secret = process.env.RECURRENTE_WEBHOOK_SECRET;

  if (!secret) {
    console.error('[Security] RECURRENTE_WEBHOOK_SECRET is not configured in the environment.');
    return res.status(500).send('Server configuration error');
  }

  if (!req.rawBody) {
    console.error('[Security] req.rawBody is missing. Ensure express.json() is configured with verify callback.');
    return res.status(500).send('Server configuration error');
  }

  // Reject old/replayed timestamps (tolerance: 5 minutes).
  const timestampSeconds = Number(svixTimestamp);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!timestampSeconds || Math.abs(nowSeconds - timestampSeconds) > 300) {
    console.error('[Security] Recurrente webhook timestamp outside tolerance window.');
    return res.status(401).send('Unauthorized: Timestamp out of range');
  }

  try {
    const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
    const signedContent = `${svixId}.${svixTimestamp}.${req.rawBody.toString('utf8')}`;
    const expectedSignature = crypto
      .createHmac('sha256', secretBytes)
      .update(signedContent)
      .digest('base64');
    const expectedBuffer = Buffer.from(expectedSignature, 'base64');

    const providedSignatures = svixSignature
      .split(' ')
      .map((part) => part.split(',')[1])
      .filter(Boolean);

    const isValid = providedSignatures.some((sig) => {
      try {
        const sigBuffer = Buffer.from(sig, 'base64');
        return sigBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(sigBuffer, expectedBuffer);
      } catch {
        return false;
      }
    });

    if (!isValid) {
      console.error('[Security] Invalid Recurrente webhook signature. Potential fake webhook attack blocked.');
      return res.status(401).send('Unauthorized: Invalid signature');
    }

    next();
  } catch (error) {
    console.error('[Security] Error verifying Recurrente webhook signature:', error.message);
    return res.status(401).send('Unauthorized: Signature verification failed');
  }
};
