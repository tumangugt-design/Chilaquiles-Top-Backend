import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';

/**
 * Descarga y transcribe una nota de voz de Telegram.
 * Soporta OPENAI_API_KEY o GROQ_API_KEY (Groq ofrece Whisper gratuito).
 * @param {object} bot - Instancia del bot de Telegram
 * @param {string} fileId - El ID del archivo de audio de Telegram
 * @returns {Promise<string>} - El texto transcrito
 */
export const processVoiceNote = async (bot, fileId) => {
  const openAiKey = process.env.OPENAI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  if (!openAiKey && !groqKey) {
    throw new Error('No se encontró OPENAI_API_KEY ni GROQ_API_KEY. Para procesar notas de voz, crea una llave gratuita en console.groq.com y agrégala al .env como GROQ_API_KEY.');
  }

  const apiKey = groqKey || openAiKey;
  const apiUrl = groqKey 
    ? 'https://api.groq.com/openai/v1/audio/transcriptions'
    : 'https://api.openai.com/v1/audio/transcriptions';

  let localFilePath = null;

  try {
    // 1. Obtener información del archivo desde Telegram
    const file = await bot.getFile(fileId);
    const fileLink = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;

    // 2. Descargar el archivo localmente
    const tempDir = path.resolve(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }
    
    const fileName = `voice_${Date.now()}.oga`;
    localFilePath = path.join(tempDir, fileName);

    const response = await axios({
      method: 'GET',
      url: fileLink,
      responseType: 'stream',
    });

    // Esperar a que el archivo se guarde
    await new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(localFilePath);
      response.data.pipe(writer);
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    // 3. Enviar a Groq u OpenAI para transcripción (ambos usan el formato Whisper de OpenAI)
    const formData = new FormData();
    formData.append('file', fs.createReadStream(localFilePath));
    formData.append('model', groqKey ? 'whisper-large-v3' : 'whisper-1'); // Groq usa whisper-large-v3

    const aiResponse = await axios.post(apiUrl, formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${apiKey}`,
      },
    });

    return aiResponse.data.text;

  } catch (error) {
    console.error('Error procesando nota de voz:', error.response?.data || error.message);
    throw new Error('Hubo un problema procesando la nota de voz. Verifica tu llave (Groq/OpenAI).');
  } finally {
    // 4. Limpiar el archivo temporal
    if (localFilePath && fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }
  }
};
