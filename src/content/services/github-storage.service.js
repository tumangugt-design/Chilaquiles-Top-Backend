import fetch from 'node-fetch';

export const uploadGeneratedImageToGitHub = async (buffer, filename) => {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER || 'tumangugt-design';
  const repo = process.env.GITHUB_REPO || 'Imagenes-chilaquiles';
  const branch = process.env.GITHUB_BRANCH || 'main';
  const basePath = process.env.GITHUB_GENERATED_CONTENT_PATH || 'generated-content';

  if (!token) {
    throw new Error('GITHUB_TOKEN is missing');
  }

  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  
  const path = `${basePath}/${year}/${month}/${filename}`;
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  
  const contentBase64 = buffer.toString('base64');

  const response = await fetch(apiUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Chilaquiles-Top-Backend'
    },
    body: JSON.stringify({
      message: `feat: Add generated image ${filename}`,
      content: contentBase64,
      branch: branch
    })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => null);
    console.error('[GitHub Storage] Error uploading image:', errData);
    throw new Error(`Failed to upload to GitHub: ${response.status} ${response.statusText}`);
  }

  // Example RAW URL: https://raw.githubusercontent.com/tumangugt-design/Imagenes-chilaquiles/main/generated-content/2026/06/post_abc123.png
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
  
  return {
    githubPath: path,
    rawUrl: rawUrl
  };
};
