import Inventory from '../inventory/inventory.model.js';
import Portion from '../inventory/portion.model.js';
import { peekCurrentBatchCost, getPortionQtyInBaseUnit } from '../inventory/inventory.service.js';
import Order from '../orders/order.model.js';
import { getTaxConfig, calculateISR } from '../finances/finances.service.js';
import { getGuatemalaMonthRange } from '../helpers/timezone.helper.js';
import {
  ORDER_STATUS,
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

// Porciones: el Recetario manda.
//
// Antes esto leia solo las constantes del codigo. El consumo real del pedido
// lee primero la coleccion Portion — que es lo que se edita en Recetario — y
// cae a las constantes solo si no hay documento. Eran dos fuentes de verdad
// para el mismo dato: bajar el queso de 60 g a 50 g cambiaba lo que se
// descontaba pero no lo que se costeaba, y la promo se aprobaba con una
// receta vieja.
//
// La porcion viaja como parametro (`portionOf`), no como estado del modulo:
// dos costeos simultaneos no pueden pisarse el mapa.

/** Respaldo cuando no hay Recetario cargado: las constantes del catalogo. */
const portionFromConstants = (name) =>
  Number(DEFAULT_RECIPE_CONSUMPTION[name] ?? INVENTORY_CATALOG_MAP[name]?.usedPerPlate ?? 0);

/** Resolutor de porciones con los mismos mapas que usa el descuento del pedido. */
/** Carga el Recetario y devuelve el resolutor listo para usar. */
export const loadPortionResolver = async () => {
  const [portions, inventory] = await Promise.all([Portion.find({}).lean(), Inventory.find({}).lean()]);
  return buildPortionResolver(
    Object.fromEntries(portions.map((p) => [p.name, p])),
    Object.fromEntries(inventory.map((i) => [i.name, i]))
  );
};

export const buildPortionResolver = (portionMap, inventoryMap) => (name) => {
  const fromRecetario = Number(getPortionQtyInBaseUnit(name, portionMap, inventoryMap));
  if (Number.isFinite(fromRecetario) && fromRecetario > 0) return fromRecetario;
  return portionFromConstants(name);
};

/**
 * Ingredientes de un plato, con la cantidad que consume.
 * Divorciados parte la salsa a la mitad de cada una, igual que en el menu.
 */
export const recipeRowsForPlate = (plate = {}, portionOf = portionFromConstants) => {
  const rows = FIXED_RECIPE_INGREDIENT_NAMES.map((name) => ({ name, amount: portionOf(name) }));

  const sauce = String(plate.sauce || '').toUpperCase();
  if (sauce === 'DIVORCIADOS') {
    rows.push({ name: 'salsa roja', amount: SAUCE_HALF_PORTION_ML });
    rows.push({ name: 'salsa verde', amount: SAUCE_HALF_PORTION_ML });
  } else if (sauce) {
    const n = toStockName(sauce, 'Salsas');
    if (n) rows.push({ name: n, amount: portionOf(n) || SAUCE_FULL_PORTION_ML });
  }

  for (const [value, category] of [[plate.protein, 'Proteínas'], [plate.complement, 'Complementos']]) {
    if (!value) continue;
    const n = toStockName(value, category);
    if (n) rows.push({ name: n, amount: portionOf(n) });
  }

  // baseRecipe marca lo que se QUITA: ausente o true = lleva.
  for (const name of BASE_INGREDIENT_NAMES) {
    const key = BASE_KEY_BY_INGREDIENT[name];
    const included = Array.isArray(plate.selectedBases)
      ? plate.selectedBases.includes(name)
      : plate.baseRecipe?.[key] !== false;
    if (included) rows.push({ name, amount: portionOf(name) });
  }

  return rows.filter((r) => r.amount > 0);
};

/** Empaque de un plato individual, con los ajustes manuales aplicados. */
export const packagingRowsForPlate = (plate = {}, portionOf = portionFromConstants) => {
  const sauce = String(plate.sauce || 'ROJA').toUpperCase();
  const auto = [
    ...FIXED_PACKAGING_NAMES.map((name) => ({ name, qty: portionOf(name) || 1 })),
    ...(SAUCE_PACKAGING[sauce] || SAUCE_PACKAGING.ROJA),
  ];
  const overrides = plate.packagingOverrides || {};
  const byName = new Map(auto.map((r) => [r.name, r.qty]));
  for (const [name, qty] of Object.entries(overrides)) byName.set(name, Number(qty) || 0);
  return [...byName.entries()].map(([name, qty]) => ({ name, qty })).filter((r) => r.qty > 0);
};

/**
 * Costo vigente de UNA unidad de catalogo (un gramo, un mililitro, una pieza).
 *
 * Dos fuentes, en orden:
 *  1. El lote FIFO vigente (peekCurrentBatchCost), que ya devuelve el costo
 *     por unidad de catalogo. Eso es un costo trazado.
 *  2. Si el producto todavia no paso por Compras, Inventory.lastPrice.
 *
 * OJO con la segunda: `lastPrice` NO es el costo por gramo. Es el costo de
 * UNA PORCION — se escribe como `unitPrice x usedPerPlate` en
 * stock-credit.service.js:83. Usarlo tal cual multiplicaba el precio de una
 * porcion por los gramos de esa misma porcion: el queso entraba a Q3.97 x 60,
 * la salsa a su porcion x 200, y un solo plato costeaba Q913 en vez de ~Q20.
 * Dividirlo entre la porcion lo devuelve a costo por unidad.
 *
 * traced=false marca que el numero es una estimacion, no un costo trazado a
 * un lote real — el llamador lo reporta como cobertura.
 */
const unitCostFor = async (name, invByName, portionOf) => {
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

  const perPortion = Number(item?.lastPrice || 0);
  const portion = Number(portionOf(name)) || 0;
  if (perPortion > 0 && portion > 0) {
    return { cost: perPortion / portion, traced: false };
  }
  return { cost: 0, traced: false };
};

/**
 * Costea una promocion completa.
 *
 * @param {Array}  plates            platos de la promo
 * @param {object} opts
 * @param {number} opts.price        precio promocional, para utilidad y margen
 * @param {string} opts.packagingMode 'porPlato' (default) o 'compartido'
 * @param {string} opts.paymentMethod 'tarjeta' (default) o 'efectivo' — cambia
 *        cuanto se lleva Recurrente, y por lo tanto el margen neto
 * @param {object} opts.sharedPackaging  {nombre: cantidad} cuando el empaque
 *        es de toda la promo y no de cada plato — el caso del combo que se
 *        reparte: una caja grande, platos de papel y cubiertos por persona,
 *        en vez de N envases individuales.
 */
export const costPromotion = async (plates = [], opts = {}) => {
  const { price, packagingMode = 'porPlato', sharedPackaging = null, paymentMethod = 'tarjeta' } = opts;

  const inventory = await Inventory.find({}).lean();
  const invByName = new Map(inventory.map((i) => [i.name, i]));

  // Mismas porciones que usa el descuento real del pedido.
  const portions = await Portion.find({}).lean();
  const portionOf = buildPortionResolver(
    Object.fromEntries(portions.map((p) => [p.name, p])),
    Object.fromEntries(inventory.map((i) => [i.name, i]))
  );

  const cache = new Map();
  const costOf = async (name) => {
    if (!cache.has(name)) cache.set(name, await unitCostFor(name, invByName, portionOf));
    return cache.get(name);
  };

  const platesOut = [];
  let untraced = 0;
  let lines = 0;

  for (const [idx, plate] of plates.entries()) {
    const items = [];

    for (const row of recipeRowsForPlate(plate, portionOf)) {
      const { cost, traced } = await costOf(row.name);
      lines += 1;
      if (!traced) untraced += 1;
      items.push({ name: row.name, kind: 'receta', amount: row.amount, unitCost: cost, cost: round(cost * row.amount), traced });
    }

    if (packagingMode === 'porPlato') {
      for (const row of packagingRowsForPlate(plate, portionOf)) {
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

  // Lo anterior es el margen sobre insumos: util para saber si la receta se
  // paga sola, pero no es lo que queda en el banco. Esto si.
  let fiscal = null;
  let netProfit = null;
  let netMargin = null;
  if (priceNum > 0) {
    const cfg = await getTaxConfig();
    fiscal = applyFiscalLayer(priceNum, cfg, {
      paymentMethod,
      monthRentaBruta: await monthToDateRentaBruta(cfg),
    });
    netProfit = round(priceNum - fiscal.total - totalCost);
    netMargin = round((netProfit / priceNum) * 100);
  }

  return {
    plates: platesOut,
    sharedPackaging: sharedOut,
    packagingMode,
    totalCost,
    price: priceNum || null,
    profit,
    margin,
    fiscal,
    netProfit,
    netMargin,
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
 * umbral, salvo override explicito.
 *
 * El umbral se mide contra el margen NETO, no contra el bruto sobre insumos.
 * Una promo puede dejar 30% sobre ingredientes y aun asi perder plata: de
 * cada Q100 cobrados con tarjeta, antes de tocar un tomate ya se fueron
 * ~Q10.71 de IVA, Q2 + 4.5% de Recurrente, Q0.25 de factura y el ISR del
 * tramo. Validar el bruto era validar una cuenta que nunca llega al banco.
 *
 * Se devuelve el costeo completo junto al veredicto para que el llamador no
 * calcule dos veces.
 */
export const validatePromotionMargin = async (plates, opts = {}) => {
  const { price, minMarginPercent, allowLowMargin = false } = opts;
  const costing = await costPromotion(plates, opts);

  const threshold = Number.isFinite(Number(minMarginPercent))
    ? Number(minMarginPercent)
    : DEFAULT_MARGIN_ALERT_PERCENT;

  if (costing.netMargin === null) {
    return { ok: true, costing, reason: 'sin-precio' };
  }
  if (costing.netMargin < threshold && !allowLowMargin) {
    const f = costing.fiscal;
    return {
      ok: false,
      costing,
      reason: costing.netMargin < 0 ? 'perdida' : 'bajo-umbral',
      threshold,
      message: costing.netMargin < 0
        ? `Esta promocion pierde Q${Math.abs(costing.netProfit).toFixed(2)} por venta (margen neto ${costing.netMargin}%).`
        : `El margen neto es ${costing.netMargin}% y el minimo configurado es ${threshold}%.`,
      // El desglose viaja con el rechazo para que el panel pueda decir POR QUE
      // no cierra, en vez de solo negarse.
      breakdown: f && {
        precio: costing.price,
        iva: f.ivaDebito,
        comisionRecurrente: f.comisionRecurrente,
        facturacion: f.facturacionFee,
        isr: f.isr,
        insumos: costing.totalCost,
        queda: costing.netProfit,
      },
    };
  }
  return { ok: true, costing, threshold };
};

// Cuantas porciones de un mismo tipo caben en un vasito de 8 onz cuando la
// promo se reparte: dos. Y dos servilletas por persona. Son las dos reglas
// que Denilson ya aplica a mano al armar un combo.
const PORTIONS_PER_CUP = 2;
const NAPKINS_PER_PERSON = 2;

/** Mililitros de cada salsa que pide el conjunto de platos. */
const sauceVolumes = (plates = [], portionOf = portionFromConstants) => {
  const vol = {};
  const add = (name, ml) => {
    if (!name || !(ml > 0)) return;
    vol[name] = (vol[name] || 0) + ml;
  };
  for (const plate of plates) {
    const sauce = String(plate?.sauce || '').toUpperCase();
    if (sauce === 'DIVORCIADOS') {
      add('salsa roja', SAUCE_HALF_PORTION_ML);
      add('salsa verde', SAUCE_HALF_PORTION_ML);
    } else if (sauce) {
      const name = toStockName(sauce, 'Salsas');
      add(name, portionOf(name) || SAUCE_FULL_PORTION_ML);
    }
  }
  return vol;
};

/** Cuantos platos piden cada opcion de una categoria del menu. */
const countBy = (plates = [], category) => {
  const field = category === 'Proteínas' ? 'protein' : 'complement';
  const out = {};
  for (const plate of plates) {
    const name = toStockName(plate?.[field], category);
    if (!name) continue;
    out[name] = (out[name] || 0) + 1;
  }
  return out;
};

export const proposePackaging = (plates = [], mode = 'compartido', portionOf = portionFromConstants) => {
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
      for (const row of packagingRowsForPlate(p, portionOf)) add(row.name, row.qty, 'empaque individual del plato');
    }
    return { items, reasoning };
  }

  // Salsas: un vasito de 8 oz por cada porcion de 200 ml de una misma salsa.
  // Divorciados parte en dos de 4 oz, asi que ese caso se cuenta aparte.
  const vol = sauceVolumes(plates, portionOf);
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
