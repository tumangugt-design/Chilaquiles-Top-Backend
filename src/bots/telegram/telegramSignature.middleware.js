export const verifyTelegramSignature = (req, res, next) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!token) {
    console.error('[Security] TELEGRAM_BOT_TOKEN is not configured in the environment.');
    return res.status(500).send('Server configuration error');
  }

  const expectedSecretToken = token.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 256);
  const providedSecretToken = req.headers['x-telegram-bot-api-secret-token'];

  if (!providedSecretToken) {
    console.error('[Security] Telegram Webhook received without X-Telegram-Bot-Api-Secret-Token header.');
    return res.status(401).send('Unauthorized: Missing secret token');
  }

  if (providedSecretToken !== expectedSecretToken) {
    console.error(`[Security] Invalid Telegram webhook secret token detected. Potential fake webhook attack blocked.`);
    return res.status(401).send('Unauthorized: Invalid secret token');
  }

  // If tokens match, proceed to the next middleware/controller
  next();
};
