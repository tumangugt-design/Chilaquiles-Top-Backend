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

export const getClaudeCompletion = async (systemPrompt, userPrompt, isJson = false, temperature = 0.7) => {
  const client = getClient();
  const model = 'claude-sonnet-4-6';

  try {
    const response = await client.messages.create({
      model: model,
      max_tokens: 4000,
      temperature: temperature,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ]
    });

    return response.content[0].text;
  } catch (error) {
    console.error('[Claude Service] Error calling Anthropic API:', error);
    throw error;
  }
};
