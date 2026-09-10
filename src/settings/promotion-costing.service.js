import Inventory from '../inventory/inventory.model.js';
import { peekCurrentBatchCost } from '../inventory/inventory.service.js';
import {
  INVENTORY_CATALOG_MAP,
  DEFAULT_RECIPE_CONSUMPTION,
  SAUCE_FULL_PORTION_ML,
  SAUCE_HALF_PORTION_ML,
  resolveStockName,
} from '../helpers/constants.js';

// ============================================================
// COSTEO DE PROMOCIONES
//
// Este servicio existia solo en el navegador (Admin.jsx). Mientras
// vivio ahi, ningun agente podia crear una promocion costeada: el
// backend recibia estimatedTotalCost / estimatedProfit / estimatedMargin
// ya masticados por el cliente y los guardaba sin verificar nada.
//
// Una sola base de costo: el lote FIFO vigente (peekCurrentBatchCost),
// que es lo que de verdad se pagaria si la promo se vendiera ahora.
// Antes el precio se decidia con la ultima compra y el margen se
// vigilaba con el lote vigente — dos reglas distintas para la misma
// decision. Cuando un producto no tiene lotes todavia, se cae a
// lastPrice y el resultado lo marca, para que nadie confunda un costo
// trazado con una estimacion.
// ============================================================

const BASE_INGREDIENT_NAMES = ['crema', 'cebolla picada', 'cilantro picado'];
const FIXED_RECIPE_INGREDIENT_NAMES = ['totopos', 'queso'];

// Empaque por plato individual: lo que se arma cuando la promo son N
// platos servidos por separado.
const FIXED_PACKAGING_NAMES = ['plato rectangular', 'tenedor', 'servilleta', 'sticker'];
const SAUCE_PACKAGING = {
  ROJA: [{ name: 'plato de 8 onz', qty: 1 }, { name: 'tapadera de 8 onz', qty: 1 }],
  VERDE: [{ name: 'plato de 8 onz', qty: 1 }, { name: 'tapadera de 8 onz', qty: 1 }],
  DIVORCIADOS: [{ name: 'plato de 4 onz', qty: 2 }, { name: 'tapadera de 4 onz', qty: 2 }],
};

// Menu que ve el cliente -> llave interna de inventario.
const MENU_TO_STOCK = {
  Salsas: { ROJA: 'salsa roja', VERDE: 'salsa verde' },
  'Proteínas': { STEAK: 'steak', POLLO: 'pollo', CHORIZO: 'chorizo argentino', PULLED_PORK: 'pulled pork' },
  Complementos: { AGUACATE: 'aguacate hass', CEBOLLA_CARAMELIZADA: 'cebolla caramelizada', QUESO_EXTRA: 'queso extra' },
};

const BASE_KEY_BY_INGREDIENT = { crema: 'cream', 'cebolla picada': 'onion', 'cilantro picado': 'cilantro' };

const round = (n) => Math.round((Number(n) || 0) * 100) / 100;

const toStockName = (value, category) => {
  if (!value) return null;
  const key = String(value).trim().toUpperCase().replace(/\s+/g, '_');
  const mapped = MENU_TO_STOCK[category]?.[key];
  if (mapped) return mapped;
  return resolveStockName(String(value).trim().toLowerCase());
};

const portionFor = (name) =>
  Number(DEFAULT_RECIPE_CONSUMPTION[name] ?? INVENTORY_CATALOG_MAP[name]?.usedPerPlate ?? 0);

/**
 * Ingredientes de un plato, con la cantidad que consume.
 * Divorciados parte la salsa a la mitad de cada una, igual que en el menu.
 */
export const recipeRowsForPlate = (plate = {}) => {
  const rows = FIXED_RECIPE_INGREDIENT_NAMES.map((name) => ({ name, amount: portionFor(name) }));

  const sauce = String(plate.sauce || '').toUpperCase();
  if (sauce === 'DIVORCIADOS') {
    rows.push({ name: 'salsa roja', amount: SAUCE_HALF_PORTION_ML });
    rows.push({ name: 'salsa verde', amount: SAUCE_HALF_PORTION_ML });
  } else if (sauce) {
    const n = toStockName(sauce, 'Salsas');
    if (n) rows.push({ name: n, amount: portionFor(n) || SAUCE_FULL_PORTION_ML });
  }

  for (const [value, category] of [[plate.protein, 'Proteínas'], [plate.complement, 'Complementos']]) {
    if (!value) continue;
    const n = toStockName(value, category);
    if (n) rows.push({ name: n, amount: portionFor(n) });
  }

  // baseRecipe marca lo que se QUITA: ausente o true = lleva.
  for (const name of BASE_INGREDIENT_NAMES) {
    const key = BASE_KEY_BY_INGREDIENT[name];
    const included = Array.isArray(plate.selectedBases)
      ? plate.selectedBases.includes(name)
      : plate.baseRecipe?.[key] !== false;
    if (included) rows.push({ name, amount: portionFor(name) });
  }

  return rows.filter((r) => r.amount > 0);
};

/** Empaque de un plato individual, con los ajustes manuales aplicados. */
export const packagingRowsForPlate = (plate = {}) => {
  const sauce = String(plate.sauce || 'ROJA').toUpperCase();
  const auto = [
    ...FIXED_PACKAGING_NAMES.map((name) => ({ name, qty: portionFor(name) || 1 })),
    ...(SAUCE_PACKAGING[sauce] || SAUCE_PACKAGING.ROJA),
  ];
  const overrides = plate.packagingOverrides || {};
  const byName = new Map(auto.map((r) => [r.name, r.qty]));
  for (const [name, qty] of Object.entries(overrides)) byName.set(name, Number(qty) || 0);
  return [...byName.entries()].map(([name, qty]) => ({ name, qty })).filter((r) => r.qty > 0);
};

/**
 * Costo unitario vigente de un producto, en su unidad de catalogo.
 * traced=false significa que el producto aun no paso por Compras y el
 * costo es una estimacion, no un dato trazado a un lote.
 */
const unitCostFor = async (name, invByName) => {
  const item = invByName.get(name);
  const unit = item?.unit || INVENTORY_CATALOG_MAP[name]?.unit || 'und';
  try {
    const peek = await peekCurrentBatchCost(name, unit);
    if (peek && peek.costPerCatalogUnit != null) {
      return { cost: Number(peek.costPerCatalogUnit) || 0, traced: true };
    }
  } catch {
    // unidad del lote incompatible: se cae al respaldo
  }
  return { cost: Number(item?.lastPrice || 0), traced: false };
};

/**
 * Costea una promocion completa.
 *
 * @param {Array}  plates            platos de la promo
 * @param {object} opts
 * @param {number} opts.price        precio promocional, para utilidad y margen
 * @param {string} opts.packagingMode 'porPlato' (default) o 'compartido'
 * @param {object} opts.sharedPackaging  {nombre: cantidad} cuando el empaque
 *        es de toda la promo y no de cada plato — el caso del combo que se
 *        reparte: una caja grande, platos de papel y cubiertos por persona,
 *        en vez de N envases individuales.
 */
export const costPromotion = async (plates = [], opts = {}) => {
  const { price, packagingMode = 'porPlato', sharedPackaging = null } = opts;

  const inventory = await Inventory.find({}).lean();
  const invByName = new Map(inventory.map((i) => [i.name, i]));

  const cache = new Map();
  const costOf = async (name) => {
    if (!cache.has(name)) cache.set(name, await unitCostFor(name, invByName));
    return cache.get(name);
  };

  const platesOut = [];
  let untraced = 0;
  let lines = 0;

  for (const [idx, plate] of plates.entries()) {
    const items = [];

    for (const row of recipeRowsForPlate(plate)) {
      const { cost, traced } = await costOf(row.name);
      lines += 1;
      if (!traced) untraced += 1;
      items.push({ name: row.name, kind: 'receta', amount: row.amount, unitCost: cost, cost: round(cost * row.amount), traced });
    }

    if (packagingMode === 'porPlato') {
      for (const row of packagingRowsForPlate(plate)) {
        const { cost, traced } = await costOf(row.name);
        lines += 1;
        if (!traced) untraced += 1;
        items.push({ name: row.name, kind: 'empaque', amount: row.qty, unitCost: cost, cost: round(cost * row.qty), traced });
      }
    }

    platesOut.push({ index: idx, items, cost: round(items.reduce((t, i) => t + i.cost, 0)) });
  }

  const sharedOut = [];
  if (packagingMode === 'compartido' && sharedPackaging) {
    for (const [name, qty] of Object.entries(sharedPackaging)) {
      const amount = Number(qty) || 0;
      if (amount <= 0) continue;
      const { cost, traced } = await costOf(name);
      lines += 1;
      if (!traced) untraced += 1;
      sharedOut.push({ name, kind: 'empaque', amount, unitCost: cost, cost: round(cost * amount), traced });
    }
  }

  const totalCost = round(
    platesOut.reduce((t, p) => t + p.cost, 0) + sharedOut.reduce((t, i) => t + i.cost, 0)
  );

  const priceNum = Number(price) || 0;
  const profit = priceNum > 0 ? round(priceNum - totalCost) : null;
  const margin = priceNum > 0 ? round(((priceNum - totalCost) / priceNum) * 100) : null;

  return {
    plates: platesOut,
    sharedPackaging: sharedOut,
    packagingMode,
    totalCost,
    price: priceNum || null,
    profit,
    margin,
    // Cobertura: que porcion del costo viene de un lote real de Compras.
    // Un margen calculado sobre estimaciones no vale lo mismo que uno trazado.
    coverage: lines > 0 ? round(((lines - untraced) / lines) * 100) : 0,
    untracedLines: untraced,
    costedAt: new Date().toISOString(),
  };
};

export const DEFAULT_MARGIN_ALERT_PERCENT = 15;

/**
 * Regla dura al guardar: una promocion no puede salir a perdida ni bajo el
 * umbral, salvo override explicito. Devuelve el costeo junto al veredicto
 * para que el llamador no tenga que calcular dos veces.
 */
export const validatePromotionMargin = async (plates, opts = {}) => {
  const { price, minMarginPercent, allowLowMargin = false } = opts;
  const costing = await costPromotion(plates, opts);

  const threshold = Number.isFinite(Number(minMarginPercent))
    ? Number(minMarginPercent)
    : DEFAULT_MARGIN_ALERT_PERCENT;

  if (costing.margin === null) {
    return { ok: true, costing, reason: 'sin-precio' };
  }
  if (costing.margin < threshold && !allowLowMargin) {
    return {
      ok: false,
      costing,
      reason: costing.margin < 0 ? 'perdida' : 'bajo-umbral',
      threshold,
      message: costing.margin < 0
        ? `Esta promoción pierde Q${Math.abs(costing.profit).toFixed(2)} por venta (margen ${costing.margin}%).`
        : `El margen es ${costing.margin}% y el mínimo configurado es ${threshold}%.`,
    };
  }
  return { ok: true, costing, threshold };
};

// ============================================================
// PROPUESTA DE EMPAQUE
//
// El empaque de una promocion NO se deriva del plato. Una promo de
// cuatro que se reparte lleva una caja grande y platos de papel, no
// cuatro envases individuales. Por eso hoy toca ir plato por plato
// borrando lo que sobra: hay una regla automatica peleando contra un
// caso que no le toca.
//
// Esto propone la lista de toda la promo, derivada de la composicion.
// La propuesta NO es la verdad: se guarda con la promo y el admin (o
// el agente) la ajusta. Lo que se costea es la lista guardada.
// ============================================================

const PORTIONS_PER_CUP = 2;      // un vasito de 8 oz sirve a dos personas
const NAPKINS_PER_PERSON = 2;

/** Volumen de cada salsa que consume la promo completa, en ml. */
const sauceVolumes = (plates) => {
  const vol = {};
  for (const p of plates) {
    for (const row of recipeRowsForPlate(p)) {
      if (row.name === 'salsa roja' || row.name === 'salsa verde') {
        vol[row.name] = (vol[row.name] || 0) + row.amount;
      }
    }
  }
  return vol;
};

/** Cuenta cuantos platos llevan cada proteina y cada complemento. */
const countBy = (plates, category) => {
  const out = {};
  for (const p of plates) {
    const value = category === 'Proteínas' ? p.protein : p.complement;
    const name = toStockName(value, category);
    if (name) out[name] = (out[name] || 0) + 1;
  }
  return out;
};

/**
 * @param {Array}  plates
 * @param {string} mode 'compartido' (se reparte) o 'porPlato' (individuales)
 * @returns {{items: object, reasoning: Array}} lista y por que de cada linea
 */
export const proposePackaging = (plates = [], mode = 'compartido') => {
  const people = plates.length;
  const items = {};
  const reasoning = [];
  const add = (name, qty, why) => {
    if (qty <= 0) return;
    items[name] = (items[name] || 0) + qty;
    reasoning.push({ name, qty, why });
  };

  if (mode === 'porPlato') {
    for (const p of plates) {
      for (const row of packagingRowsForPlate(p)) add(row.name, row.qty, 'empaque individual del plato');
    }
    return { items, reasoning };
  }

  // Salsas: un vasito de 8 oz por cada porcion de 200 ml de una misma salsa.
  // Divorciados parte en dos de 4 oz, asi que ese caso se cuenta aparte.
  const vol = sauceVolumes(plates);
  let cups8 = 0;
  for (const [salsa, ml] of Object.entries(vol)) {
    const n = Math.ceil(ml / SAUCE_FULL_PORTION_ML);
    cups8 += n;
    reasoning.push({ name: 'plato de 8 onz', qty: n, why: `${ml} ml de ${salsa} = ${n} vasito(s) de 200 ml` });
  }

  // Proteina y complemento: un vasito por cada dos personas del mismo tipo.
  for (const category of ['Proteínas', 'Complementos']) {
    for (const [name, count] of Object.entries(countBy(plates, category))) {
      const n = Math.ceil(count / PORTIONS_PER_CUP);
      cups8 += n;
      reasoning.push({ name: 'plato de 8 onz', qty: n, why: `${count} porcion(es) de ${name} = ${n} vasito(s) para repartir` });
    }
  }

  if (cups8 > 0) {
    items['plato de 8 onz'] = cups8;
    items['tapadera de 8 onz'] = cups8;
    reasoning.push({ name: 'tapadera de 8 onz', qty: cups8, why: 'una tapa por vasito' });
  }

  // Los totopos de toda la promo van en una sola caja grande.
  add('plato familiar', 1, `totopos de ${people} platos en una caja`);
  add('plato papel familiar', people, 'un plato de papel por persona');
  add('tenedor', people, 'un tenedor por persona');
  add('servilleta', people * NAPKINS_PER_PERSON, `${NAPKINS_PER_PERSON} servilletas por persona`);
  add('sticker', 1, 'un sticker en la caja');
  add('bolsa kraft', 1, 'una bolsa por pedido');

  return { items, reasoning };
};
