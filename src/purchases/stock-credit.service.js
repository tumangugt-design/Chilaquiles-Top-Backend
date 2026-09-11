import Inventory from '../inventory/inventory.model.js';
import { roundUnitCost } from '../helpers/money.js';
import Portion from '../inventory/portion.model.js';
import { manualStockAdjustment, convertAmountToCatalogUnit } from '../inventory/inventory.service.js';
import { convertBetweenUnits } from './purchase.service.js';
import { ITEM_TYPES, toDisplayLabel } from '../helpers/constants.js';

const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100;
const roundQty = (value) => Math.round(Number(value || 0) * 1000) / 1000;

// Unidad catalogo que le corresponde a una unidad de compra. El stock siempre
// se lleva en g / ml / und para que todo el costeo sea comparable.
export const catalogUnitFor = (unit = '') => {
  const u = String(unit || '').trim().toLowerCase();
  if (['g', 'kg', 'lb', 'oz'].includes(u)) return 'g';
  if (['ml', 'l'].includes(u)) return 'ml';
  return 'und';
};

// Asegura que exista el producto en el catalogo maestro (Inventory) con su
// tipo, etiqueta visible y proceso. Se usa tanto al comprar como al producir.
export const ensureInventoryItem = async ({ name, itemType, unit, category, processName = '' }) => {
  const normalized = String(name || '').trim().toLowerCase();
  let item = await Inventory.findOne({ name: normalized });
  if (item) return item;

  item = await Inventory.create({
    name: normalized,
    unit: unit || catalogUnitFor(unit),
    category: category || (itemType === ITEM_TYPES.MATERIA_PRIMA ? 'Materia prima' : 'Otros'),
    itemType: itemType || ITEM_TYPES.INSUMO_LISTO,
    displayLabel: toDisplayLabel(normalized),
    processName: processName || '',
    stock: 0,
    minimumStock: itemType === ITEM_TYPES.MATERIA_PRIMA ? 0 : 5,
    isActive: true,
    sourceType: itemType === ITEM_TYPES.PRODUCTO_TERMINADO ? 'preparado_interno' : 'comprado'
  });
  return item;
};

// Acredita a Stock una cantidad recibida/producida y congela el costo por
// porcion del momento. Es el mismo camino para una compra de insumo listo y
// para un lote de produccion: lo unico que cambia es el motivo y el origen.
export const creditStock = async ({ stockItemName, quantity, unit, totalCost, actor, reason, itemType }) => {
  const normalized = String(stockItemName || '').trim().toLowerCase();

  const stockItem = await ensureInventoryItem({
    name: normalized,
    itemType: itemType || ITEM_TYPES.INSUMO_LISTO,
    unit: catalogUnitFor(unit)
  });

  let portionItem = await Portion.findOne({ name: normalized });
  if (!portionItem && stockItem.itemType !== ITEM_TYPES.MATERIA_PRIMA) {
    portionItem = await Portion.create({
      name: normalized,
      usedPerPlate: 1,
      unit: stockItem.unit || unit,
      price: 0
    });
  }

  const storedUnit = stockItem.unit || unit;

  // Antes, si la conversion fallaba se usaba el numero crudo como si ya
  // estuviera en la unidad destino: 10 lbs de queso entraban como 10 GRAMOS y
  // el costo salia a Q30 el gramo, con respuesta 200 y sin un solo error
  // visible. Ahora se propaga: es mejor rechazar la compra que acreditarla
  // 450 veces mal.
  const amountInStoredUnit = roundQty(convertBetweenUnits(quantity, unit, storedUnit));

  // Costo POR GRAMO / POR MILILITRO: seis decimales, no dos. A dos decimales
  // un insumo barato queda en Q0.00 y uno normal se desvia hasta 43%.
  const unitPriceInStoredUnit = amountInStoredUnit > 0 ? roundUnitCost(totalCost / amountInStoredUnit) : 0;

  let portionPrice;
  if (portionItem) {
    let portionInStoredUnit = portionItem.usedPerPlate;
    if (portionItem.unit !== storedUnit) {
      // Aqui si se tolera: la porcion es un dato de Recetario, no de la compra.
      // Si no convierte, se usa tal cual y el costo queda aproximado, pero la
      // compra no se pierde.
      try {
        portionInStoredUnit = convertAmountToCatalogUnit(portionItem.usedPerPlate, portionItem.unit, storedUnit);
      } catch (conversionError) {
        portionInStoredUnit = portionItem.usedPerPlate;
      }
    }
    portionPrice = roundMoney(unitPriceInStoredUnit * portionInStoredUnit);
  }

  const updatedItem = await manualStockAdjustment({
    name: normalized,
    amount: amountInStoredUnit,
    type: 'IN',
    totalPrice: totalCost,
    portionPrice,
    inputAmount: quantity,
    inputUnit: unit,
    storedUnit,
    actor,
    reason
  });

  return { item: updatedItem, amountInStoredUnit, storedUnit, unitPriceInStoredUnit, portionPrice };
};

// Descuenta de Stock lo que se consumio como insumo en un lote de produccion.
// Es lo que hace visible la merma: entran 1000 g de cebolla, salen 850 g de
// cebolla picada, y los 150 g de diferencia quedan registrados en el lote.
export const debitInputStock = async ({ ingredientName, quantity, unit, actor, reason }) => {
  const normalized = String(ingredientName || '').trim().toLowerCase();
  const item = await Inventory.findOne({ name: normalized });
  if (!item) return null;

  // Sin respaldo al numero crudo: si la unidad no convierte, se propaga.
  const amountInStoredUnit = roundQty(convertBetweenUnits(quantity, unit, item.unit));
  if (!amountInStoredUnit || amountInStoredUnit <= 0) return null;

  // Lotes anteriores al espejo de Stock pueden dejar existencia en 0: nunca se
  // baja de cero para no inventar inventario negativo. Pero si se pide MAS de
  // lo que hay, ya no se recorta en silencio: antes un lote podia declarar que
  // consumio 1000 g y haber descontado 300, dejando la merma del lote en un
  // numero falso — que es justo la metrica que este modulo existe para medir.
  const available = Number(item.stock || 0);
  if (available <= 0) return null;
  if (amountInStoredUnit > available + 0.001) {
    const error = new Error(
      `No hay suficiente "${normalized}" en Stock: se necesitan ${amountInStoredUnit} ${item.unit} y hay ${available}. Revisa el conteo fisico o registra la compra.`
    );
    error.statusCode = 400;
    throw error;
  }

  return await manualStockAdjustment({
    name: normalized,
    amount: -Math.min(amountInStoredUnit, available),
    type: 'OUT',
    actor,
    reason
  });
};
