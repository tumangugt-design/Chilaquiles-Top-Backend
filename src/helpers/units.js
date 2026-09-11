// ============================================================
// UNIDADES — UNA SOLA TABLA
//
// Antes habia dos vocabularios distintos: convertBetweenUnits (Compras)
// conocia siete unidades, y convertAmountToCatalogUnit (Inventario) conocia
// ademas los alias en espanol. Escribir "lbs" en vez de "lb" pasaba por una
// y fallaba en la otra, y el catch de Compras usaba el numero crudo: 10 lbs
// de queso se acreditaban como 10 GRAMOS, a Q30 el gramo.
//
// Todo lo que convierta unidades pasa por aqui.
// ============================================================

export const UNIT_ALIASES = {
  g: 'g', gramo: 'g', gramos: 'g', gram: 'g', grams: 'g',
  lb: 'lb', lbs: 'lb', libra: 'lb', libras: 'lb', pound: 'lb', pounds: 'lb',
  kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg', kilogramo: 'kg', kilogramos: 'kg',
  oz: 'oz', onza: 'oz', onzas: 'oz', ounce: 'oz', ounces: 'oz',
  ml: 'ml', mililitro: 'ml', mililitros: 'ml',
  l: 'l', lt: 'l', lts: 'l', ltr: 'l', ltrs: 'l', litro: 'l', litros: 'l', litre: 'l', liter: 'l',
  und: 'und', unidad: 'und', unidades: 'und', unit: 'und', units: 'und',
  pieza: 'und', piezas: 'und', pza: 'und', pzas: 'und', u: 'und',
};

/** Texto libre -> unidad canonica. Devuelve null si no se reconoce. */
export const canonicalUnit = (value = '') => {
  const raw = String(value || '').trim().toLowerCase();
  return UNIT_ALIASES[raw] || null;
};

/** Las unicas unidades que el sistema sabe manejar. */
export const KNOWN_UNITS = ['g', 'kg', 'lb', 'oz', 'ml', 'l', 'und'];

/**
 * Valida una unidad escrita a mano. Lanza 400 con un mensaje util en vez de
 * dejar pasar un texto que despues se convierte en un costo 450 veces mayor.
 */
export const assertKnownUnit = (value, campo = 'unidad') => {
  const unit = canonicalUnit(value);
  if (!unit) {
    const error = new Error(
      `La ${campo} "${value}" no se reconoce. Usa una de: ${KNOWN_UNITS.join(', ')} (o sus nombres en espanol: libras, kilos, litros, unidades).`
    );
    error.statusCode = 400;
    throw error;
  }
  return unit;
};
