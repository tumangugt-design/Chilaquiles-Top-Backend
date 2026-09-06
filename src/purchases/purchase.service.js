import Purchase from './purchase.model.js';

const round = (value) => Math.round(Number(value || 0) * 1000) / 1000;
const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100;
const normalize = (value = '') => String(value || '').trim().toLowerCase();

// Grupos de conversion (misma logica/factores que inventory.service.js, pero
// generalizada para convertir entre CUALQUIER par de unidades del mismo tipo,
// no solo hacia la unidad catalogo g/ml/und). "oz" existe en ambos grupos
// (onza de peso vs onza fluida) - se resuelve segun el grupo del par pedido.
const MASS_TO_GRAMS = { g: 1, kg: 1000, lb: 453.59237, oz: 28.349523125 };
const VOLUME_TO_ML = { ml: 1, l: 1000, oz: 29.5735295625 };

export const convertBetweenUnits = (amount, fromUnit, toUnit) => {
  const from = normalize(fromUnit);
  const to = normalize(toUnit);
  if (from === to) return amount;
  if (from === 'und' || to === 'und') {
    if (from === to) return amount;
    const error = new Error(`No se puede convertir "${fromUnit}" a "${toUnit}".`);
    error.statusCode = 400;
    throw error;
  }
  if (MASS_TO_GRAMS[from] && MASS_TO_GRAMS[to]) {
    return amount * (MASS_TO_GRAMS[from] / MASS_TO_GRAMS[to]);
  }
  if (VOLUME_TO_ML[from] && VOLUME_TO_ML[to]) {
    return amount * (VOLUME_TO_ML[from] / VOLUME_TO_ML[to]);
  }
  const error = new Error(`No se puede convertir "${fromUnit}" a "${toUnit}": unidades incompatibles (una es de peso y la otra de volumen).`);
  error.statusCode = 400;
  throw error;
};

// Planea (SIN escribir en la base de datos) el consumo FIFO de `requiredQty`
// (en `requestedUnit`) del ingrediente en bruto `ingredientName`, entre sus
// Purchase (lotes) disponibles - puede abarcar mas de un lote. Lanza error
// si no hay suficiente cantidad disponible en total (para poder validar
// TODOS los ingredientes de un lote de produccion antes de descontar nada).
export const planPurchaseConsumption = async (ingredientName, requiredQty, requestedUnit) => {
  const name = normalize(ingredientName);
  const lots = await Purchase.find({ ingredientName: name, remainingQuantity: { $gt: 0 } }).sort({ purchaseDate: 1 });

  let needed = requiredQty;
  const consumed = [];
  const bulkOps = [];

  for (const lot of lots) {
    if (needed <= 0.0001) break;

    const availableInRequestedUnit = round(convertBetweenUnits(lot.remainingQuantity, lot.unit, requestedUnit));
    if (availableInRequestedUnit <= 0) continue;

    const take = Math.min(needed, availableInRequestedUnit);
    const takeInLotUnit = round(convertBetweenUnits(take, requestedUnit, lot.unit));
    if (takeInLotUnit <= 0) continue;

    const unitCost = lot.quantity > 0 ? lot.totalCost / lot.quantity : 0;
    const cost = roundMoney(takeInLotUnit * unitCost);

    consumed.push({ purchase: lot._id, ingredientName: name, quantityUsed: takeInLotUnit, unit: lot.unit, cost });

    const newRemaining = round(lot.remainingQuantity - takeInLotUnit);
    const depleted = newRemaining <= 0.001;
    bulkOps.push({
      updateOne: {
        filter: { _id: lot._id },
        update: { $set: { remainingQuantity: depleted ? 0 : newRemaining, isDepleted: depleted } }
      }
    });

    needed = round(needed - take);
  }

  if (needed > 0.001) {
    const error = new Error(`No hay suficiente "${ingredientName}" comprado. Faltan ${needed} ${requestedUnit} (revisa Compras).`);
    error.statusCode = 400;
    throw error;
  }

  return { ingredientName: name, consumed, bulkOps };
};

// Aplica de verdad (ya validado) los descuentos de remainingQuantity de un plan.
export const commitPurchaseConsumption = async (plan) => {
  if (plan.bulkOps.length > 0) {
    await Purchase.bulkWrite(plan.bulkOps);
  }
};
