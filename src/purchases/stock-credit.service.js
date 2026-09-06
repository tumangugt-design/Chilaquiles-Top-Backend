import Inventory from '../inventory/inventory.model.js';
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
  let amountInStoredUnit = quantity;
  try {
    amountInStoredUnit = roundQty(convertBetweenUnits(quantity, unit, storedUnit));
  } catch (conversionError) {
    amountInStoredUnit = quantity;
  }

  const unitPriceInStoredUnit = amountInStoredUnit > 0 ? roundMoney(totalCost / amountInStoredUnit) : 0;

  let portionPrice;
  if (portionItem) {
    let portionInStoredUnit = portionItem.usedPerPlate;
    if (portionItem.unit !== storedUnit) {
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

  let amountInStoredUnit = quantity;
  try {
    amountInStoredUnit = roundQty(convertBetweenUnits(quantity, unit, item.unit));
  } catch (conversionError) {
    amountInStoredUnit = quantity;
  }
  if (!amountInStoredUnit || amountInStoredUnit <= 0) return null;

  // Lotes anteriores al espejo de Stock pueden dejar existencia en 0: nunca se
  // baja de cero para no inventar inventario negativo.
  const available = Number(item.stock || 0);
  if (available <= 0) return null;
  if (amountInStoredUnit > available) amountInStoredUnit = roundQty(available);

  try {
    return await manualStockAdjustment({
      name: normalized,
      amount: -amountInStoredUnit,
      type: 'OUT',
      actor,
      reason
    });
  } catch (error) {
    console.error(`[debitInputStock] No se pudo descontar ${normalized}:`, error.message);
    return null;
  }
};
