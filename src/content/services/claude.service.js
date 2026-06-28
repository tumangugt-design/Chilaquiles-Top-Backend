import Anthropic from '@anthropic-ai/sdk';

let anthropicClient = null;

const getClient = () => {
  if (!anthropicClient) {
    const apiKey = process.env.CLAUDE_APIKEY;
    if (!apiKey) {
      throw new Error('CLAUDE_APIKEY environment variable is missing.');
    }
    anthropicClient = new Anthropic({
      apiKey: apiKey,
    });
  }
  return anthropicClient;
};

export const getClaudeCompletion = async (systemPrompt, userPrompt, isJson = false, temperature = 0.7, imageBase64 = null) => {
  const client = getClient();
  const model = 'claude-3-5-sonnet-20241022'; // Usar el modelo correcto más reciente para vision

  let messageContent = userPrompt;

  if (imageBase64) {
    // Si viene con el prefijo de data URI, lo quitamos
    const base64Data = imageBase64.includes('base64,') ? imageBase64.split('base64,')[1] : imageBase64;
    let mediaType = 'image/jpeg';
    if (imageBase64.includes('image/png')) mediaType = 'image/png';
    else if (imageBase64.includes('image/webp')) mediaType = 'image/webp';

    messageContent = [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType,
          data: base64Data
        }
      },
      {
        type: 'text',
        text: userPrompt
      }
    ];
  }

  try {
    const response = await client.messages.create({
      model: model,
      max_tokens: 4000,
      temperature: temperature,
      system: systemPrompt,
      messages: [
        { role: 'user', content: messageContent }
      ]
    });

    return response.content[0].text;
  } catch (error) {
    console.error('[Claude Service] Error calling Anthropic API:', error);
    throw error;
  }
};
