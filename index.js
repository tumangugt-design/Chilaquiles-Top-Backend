import 'dotenv/config';
import { initServer } from './configs/server.js';
import { initTelegramBot } from './src/bots/telegram/telegram.bot.js';
import { initSurveyCron } from './src/bot/survey.cron.js';

// El bot no puede tumbar el arranque de la API.
try {
  initTelegramBot();
} catch (botError) {
  console.error('[initTelegramBot] No se pudo iniciar el bot de Telegram:', botError);
}

// initSurveyCron(); // Disabled because Cloud Scheduler triggers this via API

// initServer es async: sin .catch() cualquier excepcion adentro salia como
// unhandled rejection y Node 24 mata el proceso. Ahora el fallo se registra
// con causa visible antes de salir, que es lo que se necesita en Cloud Logging.
initServer().catch((error) => {
  console.error('[initServer] El servidor no pudo arrancar:', error);
  process.exit(1);
});
