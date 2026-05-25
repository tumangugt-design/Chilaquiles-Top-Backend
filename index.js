import 'dotenv/config';
import { initServer } from './configs/server.js';
import { initTelegramBot } from './src/bots/telegram/telegram.bot.js';

initTelegramBot();
initServer();
