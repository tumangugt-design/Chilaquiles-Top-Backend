/**
 * Renderiza el HTML a PNG usando Browserless.io
 */
export const renderImageFromSpec = async (spec) => {
  const BROWSERLESS_TOKEN = process.env.BROWSERLESS_TOKEN;
  if (!BROWSERLESS_TOKEN) {
    throw new Error('BROWSERLESS_TOKEN is missing. Set it in Cloud Run environment variables.');
  }

  const { html, width = 1080, height = 1080 } = spec;

  console.log('[RenderEngine] Sending HTML to Browserless, size:', html.length, 'chars, w:', width, 'h:', height);

  const response = await fetch(`https://production-sfo.browserless.io/screenshot?token=${BROWSERLESS_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      html,
      options: {
        type: 'png',
        clip: { x: 0, y: 0, width, height }
      },
      viewport: { width, height }
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Browserless error ${response.status}: ${err}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
};