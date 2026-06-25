const {join} = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Cambia el directorio de caché para que se guarde dentro de la carpeta del proyecto
  // y no en el directorio base del sistema, permitiendo que sobreviva a los Buildpacks de Cloud Run.
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
