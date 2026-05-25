import TelegramBot from 'node-telegram-bot-api';
import { processAdminMessage } from './telegram.service.js';
import { processVoiceNote } from './telegram.audio.js';

let botInstance = null;

export const initTelegramBot = () => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log('[Telegram Bot] No TELEGRAM_BOT_TOKEN found. Bot will not be started.');
    return;
  }

  // Inicializar bot en modo polling
  const bot = new TelegramBot(token, { polling: true });
  botInstance = bot;

  console.log('[Telegram Bot] Bot initialized successfully.');

  // Helper de validación de admin (Temporalmente desactivado a petición del usuario)
  const isAuthorized = (msg) => {
    /* 
    // Lógica futura para validar administradores
    const adminIdsStr = process.env.TELEGRAM_ADMIN_IDS || '';
    const adminIds = adminIdsStr.split(',').map(id => id.trim());
    const userId = msg.from.id.toString();
    
    if (!adminIds.includes(userId)) {
      console.warn(`[Telegram Bot] Intento de acceso no autorizado por ID: ${userId}`);
      bot.sendMessage(msg.chat.id, "No tienes permisos para interactuar con este bot.");
      return false;
    }
    */
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
      const response = await processAdminMessage(text);
      
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
    const fileId = msg.voice.file_id;

    try {
      await bot.sendChatAction(chatId, 'typing');
      await bot.sendMessage(chatId, 'Transcribiendo audio... ⏳');

      console.log(`[Telegram Bot] Recibida nota de voz. Procesando...`);
      const transcribedText = await processVoiceNote(bot, fileId);
      
      console.log(`[Telegram Bot] Audio transcrito: "${transcribedText}"`);
      
      // Mostrar al usuario lo que se entendió
      await bot.sendMessage(chatId, `_Entendí:_ "${transcribedText}"\nBuscando información...`, { parse_mode: 'Markdown' });
      await bot.sendChatAction(chatId, 'typing');

      // Procesar el texto transcrito de la misma forma que un texto normal
      const response = await processAdminMessage(transcribedText);
      await bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });

    } catch (error) {
      console.error('[Telegram Bot] Error procesando nota de voz:', error);
      bot.sendMessage(chatId, 'Ocurrió un error técnico procesando tu audio. Asegúrate de tener OPENAI_API_KEY configurado en el servidor si estás usando Whisper.');
    }
  });

  // Manejo de errores generales de polling
  bot.on('polling_error', (error) => {
    console.error('[Telegram Bot] Polling Error:', error.code, error.message);
  });
};

export const getTelegramBotInstance = () => botInstance;
