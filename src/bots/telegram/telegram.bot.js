import TelegramBot from 'node-telegram-bot-api';
import { processAdminMessage } from './telegram.service.js';

let botInstance = null;

export const initTelegramBot = () => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log('[Telegram Bot] No TELEGRAM_BOT_TOKEN found. Bot will not be started.');
    return;
  }

  // Inicializar bot SIN polling
  const bot = new TelegramBot(token, { polling: false });
  botInstance = bot;

  // Registrar el Webhook en Telegram para evitar que el contenedor de Cloud Run se congele
  // Usa la URL de Cloud Run que vimos en tus logs
  const appUrl = process.env.APP_URL || 'https://chilaquiles-top-989051656049.us-central1.run.app';
  bot.setWebHook(`${appUrl}/api/bot/telegram-webhook`)
    .then(() => console.log(`[Telegram Bot] Webhook set to: ${appUrl}/api/bot/telegram-webhook`))
    .catch(err => console.error('[Telegram Bot] Error setting webhook:', err));

  console.log('[Telegram Bot] Bot initialized in Webhook mode.');

  // Helper de validación de admin — solo IDs en TELEGRAM_ADMIN_IDS pueden usar el bot
  const isAuthorized = (msg) => {
    const adminIdsStr = process.env.TELEGRAM_ADMIN_IDS || '';
    const adminIds = adminIdsStr.split(',').map(id => id.trim()).filter(Boolean);
    const userId = msg.from.id.toString();

    if (adminIds.length > 0 && !adminIds.includes(userId)) {
      console.warn(`[Telegram Bot] Intento de acceso no autorizado por ID: ${userId}`);
      bot.sendMessage(msg.chat.id, '⛔ No tienes permisos para interactuar con este bot.');
      return false;
    }

    return true;
  };

  // Manejo de mensajes de texto
  bot.on('text', async (msg) => {
    if (!isAuthorized(msg)) return;

    const chatId = msg.chat.id;
    const text = msg.text;

    try {
      // Opcional: Mostrar indicador de escribiendo
      await bot.sendChatAction(chatId, 'typing');

      console.log(`[Telegram Bot] Recibido mensaje de texto: "${text}"`);
      const response = await processAdminMessage(text, chatId);
      
      await bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('[Telegram Bot] Error procesando texto:', error);
      bot.sendMessage(chatId, 'Ocurrió un error técnico procesando tu solicitud.');
    }
  });

  // Manejo de notas de voz
  bot.on('voice', async (msg) => {
    if (!isAuthorized(msg)) return;
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId, 'Lo siento, no puedo procesar notas de voz. Por favor envíame tu consulta por texto. 📝');
  });

  // Webhook listener - Este método será llamado por Express
  bot.processUpdateWebhook = (update) => {
    bot.processUpdate(update);
  };
};

export const getTelegramBotInstance = () => botInstance;
