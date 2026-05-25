import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';

/**
 * Descarga y transcribe una nota de voz de Telegram.
 * Requiere OPENAI_API_KEY en el archivo .env.
 * @param {object} bot - Instancia del bot de Telegram
 * @param {string} fileId - El ID del archivo de audio de Telegram
 * @returns {Promise<string>} - El texto transcrito
 */
export const processVoiceNote = async (bot, fileId) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('No se encontró OPENAI_API_KEY. Configura esta variable para transcribir audios.');
  }

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

    // 3. Enviar a OpenAI (Whisper) para transcripción
    const formData = new FormData();
    formData.append('file', fs.createReadStream(localFilePath));
    formData.append('model', 'whisper-1');

    const openAiResponse = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${apiKey}`,
      },
    });

    return openAiResponse.data.text;

  } catch (error) {
    console.error('Error procesando nota de voz:', error.response?.data || error.message);
    throw new Error('Hubo un problema procesando la nota de voz.');
  } finally {
    // 4. Limpiar el archivo temporal
    if (localFilePath && fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }
  }
};
