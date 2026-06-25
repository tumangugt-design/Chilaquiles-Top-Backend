export const AssetCatalog = {
  logos: {
    logo_word_blanco: {
      url: 'https://raw.githubusercontent.com/tumangugt-design/Imagenes-chilaquiles/main/Logo/Logo%20Letras%20Blancas.png',
      description: 'Logo blanco para fondos azules'
    },
    logo_word_azul: {
      url: 'https://raw.githubusercontent.com/tumangugt-design/Imagenes-chilaquiles/main/Logo/Rectangular%20Letra%20Azul%20Transparente.png',
      description: 'Logo azul para fondos claros'
    },
    logo_cuadrado_azul: {
      url: 'https://raw.githubusercontent.com/tumangugt-design/Imagenes-chilaquiles/main/Logo/Redondo%20Fondo%20Azul.png',
      description: 'Logo oficial redondo para fondos claros'
    }
  },
  products: {
    chilaquiles_1: {
      url: 'https://raw.githubusercontent.com/tumangugt-design/Imagenes-chilaquiles/main/Fotos%20de%20Platos%20Reales%20Sin%20Fondo/Plato%201.png',
      description: 'Plato real de chilaquiles visto desde arriba'
    },
    chilaquiles_2: {
      url: 'https://raw.githubusercontent.com/tumangugt-design/Imagenes-chilaquiles/main/Fotos%20de%20Platos%20Reales%20Sin%20Fondo/Plato%202.png',
      description: 'Plato real de chilaquiles con aguacate y crema'
    },
    chilaquiles_3: {
      url: 'https://raw.githubusercontent.com/tumangugt-design/Imagenes-chilaquiles/main/Fotos%20de%20Platos%20Reales%20Sin%20Fondo/Plato%203.png',
      description: 'Plato real de chilaquiles (variante 3)'
    },
    chilaquiles_4: {
      url: 'https://raw.githubusercontent.com/tumangugt-design/Imagenes-chilaquiles/main/Fotos%20de%20Platos%20Reales%20Sin%20Fondo/Plato%204.png',
      description: 'Plato real de chilaquiles (variante 4)'
    },
    chilaquiles_5: {
      url: 'https://raw.githubusercontent.com/tumangugt-design/Imagenes-chilaquiles/main/Fotos%20de%20Platos%20Reales%20Sin%20Fondo/Plato%205.png',
      description: 'Plato real de chilaquiles (variante 5)'
    },
    chilaquiles_6: {
      url: 'https://raw.githubusercontent.com/tumangugt-design/Imagenes-chilaquiles/main/Fotos%20de%20Platos%20Reales%20Sin%20Fondo/Plato%206.png',
      description: 'Plato real de chilaquiles (variante 6)'
    }
  },
  topia: {
    topia_avatar: {
      url: 'https://raw.githubusercontent.com/tumangugt-design/Imagenes-chilaquiles/main/Personajes/TopIA/TopIA%20Avatar%20V1.png',
      description: 'Mascota oficial TopIA'
    }
  }
};

export const resolveAsset = (assetId) => {
  if (!assetId) return null;
  for (const category of Object.values(AssetCatalog)) {
    if (category[assetId]) return category[assetId].url;
  }
  return assetId; // Fallback to whatever was provided
};
