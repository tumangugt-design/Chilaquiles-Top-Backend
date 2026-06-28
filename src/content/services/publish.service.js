import axios from 'axios';

const META_GRAPH_URL = 'https://graph.facebook.com/v20.0';

/**
 * Publica una foto en la página de Facebook.
 * @param {string} imageUrl URL pública de la imagen
 * @param {string} message Texto del post (caption)
 */
export const publishToFacebook = async (imageUrl, message) => {
  const PAGE_ID = process.env.META_PAGE_ID;
  const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

  if (!PAGE_ID || !ACCESS_TOKEN) {
    throw new Error('Faltan credenciales META_PAGE_ID o META_ACCESS_TOKEN');
  }

  try {
    console.log('[Publish Service] Publicando en Facebook Page...');
    const response = await axios.post(`${META_GRAPH_URL}/${PAGE_ID}/photos`, null, {
      params: {
        url: imageUrl,
        message: message || '',
        access_token: ACCESS_TOKEN
      }
    });
    console.log('[Publish Service] Facebook Post ID:', response.data.id);
    return response.data;
  } catch (error) {
    console.error('[Publish Service] Error en Facebook:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.message || 'Error al publicar en Facebook');
  }
};

/**
 * Publica una foto en Instagram (Post o Historia).
 * @param {string} imageUrl URL pública de la imagen
 * @param {string} caption Texto del post (vacío para historias)
 * @param {boolean} isStory Si es true, publica como HISTORIA
 */
export const publishToInstagram = async (imageUrl, caption, isStory = false) => {
  // Ahora usamos la variable de entorno que ya tienes (IG_ACCESS_TOKEN)
  const ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;
  const IG_GRAPH_URL = 'https://graph.instagram.com/v20.0';

  if (!ACCESS_TOKEN) {
    throw new Error('Falta la credencial IG_ACCESS_TOKEN');
  }

  try {
    console.log(`[Publish Service] Creando contenedor IG (${isStory ? 'Story' : 'Feed'})...`);
    // Paso 1: Crear el contenedor de media (usando 'me' para cuentas de Instagram directas)
    const mediaParams = {
      image_url: imageUrl,
      access_token: ACCESS_TOKEN
    };

    if (isStory) {
      mediaParams.media_type = 'STORIES';
    } else {
      mediaParams.caption = caption || '';
    }

    const mediaRes = await axios.post(`${IG_GRAPH_URL}/me/media`, null, {
      params: mediaParams
    });

    const creationId = mediaRes.data.id;
    console.log(`[Publish Service] Contenedor IG creado: ${creationId}. Publicando...`);

    // Paso 2: Publicar el contenedor con reintentos
    let publishRes;
    let attempts = 0;
    while(attempts < 3) {
      try {
        publishRes = await axios.post(`${IG_GRAPH_URL}/me/media_publish`, null, {
          params: {
            creation_id: creationId,
            access_token: ACCESS_TOKEN
          }
        });
        break;
      } catch (err) {
        attempts++;
        if (err.response?.data?.error?.code === 9007 && attempts < 3) {
          console.log(`[Publish Service] IG Media no lista. Reintentando en 5s (intento ${attempts})...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        } else {
          throw err;
        }
      }
    }

    console.log('[Publish Service] IG Post ID:', publishRes.data.id);
    return publishRes.data;
  } catch (error) {
    console.error('[Publish Service] Error en Instagram:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.message || 'Error al publicar en Instagram');
  }
};
