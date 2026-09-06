import Purchase from './purchase.model.js';
import PurchaseAllocation from './purchase-allocation.model.js';
import Inventory from '../inventory/inventory.model.js';
import InventoryLog from '../inventory/inventoryLog.model.js';
import Recipe from '../inventory/recipe.model.js';
import TransformationProcess from '../inventory/transformation-process.model.js';
import { consumeFifoBatches, convertAmountToCatalogUnit } from '../inventory/inventory.service.js';
import { planPurchaseConsumption, commitPurchaseConsumption, convertBetweenUnits } from './purchase.service.js';
import { creditStock, debitInputStock, ensureInventoryItem, catalogUnitFor } from './stock-credit.service.js';
import { ITEM_TYPES, ITEM_TYPE_LABELS, toDisplayLabel, TRANSFORMATION_PROCESS_MAP } from '../helpers/constants.js';

const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100;
const roundQty = (value) => Math.round(Number(value || 0) * 1000) / 1000;
const normalize = (value = '') => String(value || '').trim().toLowerCase();

const badRequest = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

// GET /api/purchases
// Lista las Compras (lotes en bruto). Filtro opcional ?ingredientName=cebolla
// y ?itemType=MATERIA_PRIMA|INSUMO_LISTO
export const getPurchases = async (req, res) => {
  try {
    const filter = {};
    if (req.query.ingredientName) {
      filter.ingredientName = normalize(req.query.ingredientName);
    }
    if (req.query.itemType) {
      filter.itemType = String(req.query.itemType).trim().toUpperCase();
    }
    const purchases = await Purchase.find(filter)
      .populate('supplier', 'name')
      .sort({ purchaseDate: -1 });

    // Etiqueta visible (Title Case): la llave interna se queda en minuscula
    // porque une Compras, Stock, Porciones, Recetas y Lotes — pero nunca se
    // muestra tal cual en la interfaz.
    const items = await Inventory.find({}, 'name displayLabel itemType');
    const labelByName = new Map(items.map((i) => [i.name, i.displayLabel || toDisplayLabel(i.name)]));
    const typeByName = new Map(items.map((i) => [i.name, i.itemType]));

    const withLabels = purchases.map((p) => ({
      ...p.toObject(),
      displayLabel: labelByName.get(p.ingredientName) || toDisplayLabel(p.ingredientName),
      itemType: p.itemType || typeByName.get(p.ingredientName) || ITEM_TYPES.MATERIA_PRIMA
    }));

    return res.status(200).json(withLabels);
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching purchases', error: error.message });
  }
};

// POST /api/purchases
// Registra una Compra. Solo se puede comprar MATERIA_PRIMA o INSUMO_LISTO.
//
//  - MATERIA_PRIMA: queda como lote crudo (FIFO) esperando transformacion, y
//    se refleja en Stock para que la merma sea visible cuando se produzca.
//  - INSUMO_LISTO: no necesita transformacion, asi que ademas del lote se
//    crea su lote de Stock equivalente (pass-through) y se acredita directo:
//    ya puede usarse en platos y promociones.
export const createPurchase = async (req, res) => {
  try {
    const ingredientName = normalize(req.body.ingredientName);
    const quantity = Number(req.body.quantity);
    const unit = String(req.body.unit || '').trim();
    const totalCost = Number(req.body.totalCost);

    if (!ingredientName) {
      return res.status(400).json({ message: 'El nombre del producto es requerido.' });
    }
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ message: 'La cantidad comprada debe ser mayor a 0.' });
    }
    if (!unit) {
      return res.status(400).json({ message: 'La unidad es requerida.' });
    }
    if (totalCost === undefined || totalCost === null || Number.isNaN(totalCost) || totalCost < 0) {
      return res.status(400).json({ message: 'El costo total es requerido.' });
    }

    let stockItem = await Inventory.findOne({ name: ingredientName });

    if (stockItem?.itemType === ITEM_TYPES.PRODUCTO_TERMINADO) {
      return res.status(400).json({
        message: `"${stockItem.displayLabel || toDisplayLabel(ingredientName)}" es un Producto Terminado: no se compra, nace de un proceso de transformación con procedimiento y/o receta (Producción). Si lo que compras es el insumo crudo, regístralo como Materia Prima con su propio nombre.`
      });
    }

    // Producto nuevo (no existe en el catálogo): se crea con el tipo indicado.
    let itemType = stockItem?.itemType;
    if (!stockItem) {
      const requestedType = String(req.body.itemType || ITEM_TYPES.MATERIA_PRIMA).trim().toUpperCase();
      if (![ITEM_TYPES.MATERIA_PRIMA, ITEM_TYPES.INSUMO_LISTO].includes(requestedType)) {
        return res.status(400).json({ message: 'En Compras solo se puede registrar Materia Prima o Insumo Listo.' });
      }
      itemType = requestedType;
      stockItem = await ensureInventoryItem({
        name: ingredientName,
        itemType,
        unit: catalogUnitFor(unit),
        category: itemType === ITEM_TYPES.MATERIA_PRIMA ? 'Materia prima' : 'Otros'
      });
    }

    const purchase = await Purchase.create({
      ingredientName,
      itemType,
      quantity: roundQty(quantity),
      unit,
      remainingQuantity: roundQty(quantity),
      totalCost: roundMoney(totalCost),
      supplier: req.body.supplier || null,
      contactName: req.body.contactName || '',
      purchaseDate: req.body.purchaseDate || Date.now(),
      notes: req.body.notes || ''
    });

    const displayLabel = stockItem.displayLabel || toDisplayLabel(ingredientName);
    let stockCredit = null;
    let allocation = null;

    if (itemType === ITEM_TYPES.INSUMO_LISTO) {
      // Insumo listo: no hay transformación. Se consume el lote crudo completo
      // hacia un lote de Stock equivalente para que el costeo FIFO de la venta
      // siga funcionando igual que con un producto terminado.
      const plan = await planPurchaseConsumption(ingredientName, roundQty(quantity), unit);
      await commitPurchaseConsumption(plan);

      allocation = await PurchaseAllocation.create({
        rawInputs: plan.consumed,
        stockItemName: ingredientName,
        producedQuantity: roundQty(quantity),
        producedUnit: unit,
        remainingQuantity: roundQty(quantity),
        inheritedCost: roundMoney(totalCost),
        costPerProducedUnit: roundMoney(totalCost / quantity),
        processNames: [],
        isPassThrough: true,
        allocationDate: req.body.purchaseDate || Date.now(),
        userId: req.user?._id,
        userName: req.user?.name,
        notes: 'Insumo listo: ingreso directo a Stock, sin transformación.'
      });

      stockCredit = await creditStock({
        stockItemName: ingredientName,
        quantity: roundQty(quantity),
        unit,
        totalCost: roundMoney(totalCost),
        actor: req.user,
        itemType,
        reason: `Compra de Insumo Listo: ${quantity} ${unit} de ${displayLabel} | Costo Total Q${roundMoney(totalCost)} | Lote ${allocation._id}`
      });
    } else {
      // Materia prima: se refleja en Stock para tener existencia visible, pero
      // su salida solo puede ser hacia un lote de producción (nunca a venta).
      try {
        stockCredit = await creditStock({
          stockItemName: ingredientName,
          quantity: roundQty(quantity),
          unit,
          totalCost: roundMoney(totalCost),
          actor: req.user,
          itemType,
          reason: `Compra de Materia Prima: ${quantity} ${unit} de ${displayLabel} | Costo Total Q${roundMoney(totalCost)} | Lote ${purchase._id}`
        });
      } catch (creditError) {
        console.error('[createPurchase] No se pudo reflejar la materia prima en Stock:', creditError.message);
        stockCredit = { error: creditError.message };
      }
    }

    return res.status(200).json({
      message: itemType === ITEM_TYPES.INSUMO_LISTO
        ? 'Compra registrada y acreditada a Stock (insumo listo)'
        : 'Compra de materia prima registrada',
      purchase,
      allocation,
      stockCredit
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message || 'Error creating purchase' });
  }
};

// GET /api/purchases/:id/allocations
export const getPurchaseAllocations = async (req, res) => {
  try {
    const allocations = await PurchaseAllocation.find({ 'rawInputs.purchase': req.params.id }).sort({ allocationDate: -1 });
    return res.status(200).json(allocations);
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching allocations', error: error.message });
  }
};

// GET /api/purchases/production-batches
export const getProductionBatches = async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 200);
    const filter = {};
    // Los ingresos de insumo listo no son transformaciones: por defecto no
    // ensucian el historial de Producción.
    if (req.query.includePassThrough !== 'true') filter.isPassThrough = { $ne: true };
    const batches = await PurchaseAllocation.find(filter).sort({ allocationDate: -1 }).limit(limit);
    return res.status(200).json(batches);
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching production batches', error: error.message });
  }
};

// GET /api/purchases/allocations?stockItemName=salsa+roja
export const getAllocationsByStockItem = async (req, res) => {
  try {
    const stockItemName = normalize(req.query.stockItemName);
    if (!stockItemName) {
      return res.status(400).json({ message: 'stockItemName es requerido' });
    }
    const allocations = await PurchaseAllocation.find({ stockItemName })
      .populate('rawInputs.purchase', 'ingredientName unit purchaseDate')
      .sort({ allocationDate: -1 });
    return res.status(200).json(allocations);
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching allocations', error: error.message });
  }
};

// Costo unitario de respaldo cuando un insumo listo todavía no tiene lote de
// Stock con existencia (ej. entradas viejas anteriores a Compras/Lotes).
const getFallbackUnitCost = async (name, unit) => {
  const log = await InventoryLog.findOne({ ingredientName: name, type: 'IN', unitPrice: { $ne: null } }).sort({ createdAt: -1 });
  if (!log?.unitPrice) return 0;
  return Number(log.unitPrice);
};

// POST /api/purchases/production-batches
//
// REGLA DURA: un producto terminado solo puede nacer de un proceso de
// transformación con procedimiento seleccionado y/o receta. Aquí se valida
// esa jerarquía completa:
//   - los insumos solo pueden ser MATERIA_PRIMA o INSUMO_LISTO;
//   - el resultado solo puede ser PRODUCTO_TERMINADO;
//   - siempre hay proceso y/o receta, porque es donde se registra la merma.
export const createProductionBatch = async (req, res) => {
  try {
    const stockItemName = normalize(req.body.stockItemName);
    const producedQuantity = roundQty(Number(req.body.producedQuantity));
    const producedUnit = String(req.body.producedUnit || '').trim();
    const inputs = Array.isArray(req.body.inputs) ? req.body.inputs : [];
    const recipeId = req.body.recipeId || null;
    const processNames = (Array.isArray(req.body.processNames) ? req.body.processNames : [req.body.processName])
      .map((p) => normalize(p))
      .filter(Boolean);

    if (!stockItemName) throw badRequest('El producto terminado resultante es requerido.');
    if (!producedQuantity || producedQuantity <= 0) throw badRequest('El rendimiento (cantidad producida) debe ser mayor a 0.');
    if (!producedUnit) throw badRequest('La unidad del producto terminado es requerida.');
    if (inputs.length === 0) throw badRequest('Agrega al menos un insumo (materia prima o insumo listo).');

    // --- Proceso y/o receta: obligatorio ---
    let recipe = null;
    if (recipeId) {
      recipe = await Recipe.findById(recipeId);
      if (!recipe) throw badRequest('La receta seleccionada no existe.');
      if (recipe.outputItemName !== stockItemName) {
        throw badRequest(`La receta "${recipe.displayLabel || recipe.name}" produce "${toDisplayLabel(recipe.outputItemName)}", no "${toDisplayLabel(stockItemName)}".`);
      }
    }

    const resolvedProcesses = processNames.length > 0 ? processNames : (recipe?.processNames || []);
    if (resolvedProcesses.length === 0) {
      throw badRequest('Un producto terminado solo puede nacer de un proceso de transformación: selecciona un procedimiento (picado, pelado, cocido, licuado...) y/o una receta.');
    }

    const knownProcesses = await TransformationProcess.find({ name: { $in: resolvedProcesses } });
    const knownProcessNames = new Set(knownProcesses.map((p) => p.name));
    const unknownProcess = resolvedProcesses.find((p) => !knownProcessNames.has(p) && !TRANSFORMATION_PROCESS_MAP[p]);
    if (unknownProcess) {
      throw badRequest(`El proceso de transformación "${unknownProcess}" no existe.`);
    }

    // --- El resultado solo puede ser producto terminado ---
    let outputItem = await Inventory.findOne({ name: stockItemName });
    if (outputItem && outputItem.itemType !== ITEM_TYPES.PRODUCTO_TERMINADO) {
      throw badRequest(`"${outputItem.displayLabel || toDisplayLabel(stockItemName)}" está registrado como ${ITEM_TYPE_LABELS[outputItem.itemType] || outputItem.itemType}. De una transformación solo puede salir un Producto Terminado — usa otro nombre para el producto resultante (ej. "${toDisplayLabel(stockItemName)} Picado").`);
    }
    if (!outputItem) {
      outputItem = await ensureInventoryItem({
        name: stockItemName,
        itemType: ITEM_TYPES.PRODUCTO_TERMINADO,
        unit: catalogUnitFor(producedUnit),
        category: 'Otros',
        processName: resolvedProcesses[0]
      });
    }
    if (!outputItem.processName && resolvedProcesses[0]) {
      outputItem.processName = resolvedProcesses[0];
      await outputItem.save();
    }

    const normalizedInputs = inputs.map((inp) => ({
      ingredientName: normalize(inp?.ingredientName),
      quantity: roundQty(Number(inp?.quantity)),
      unit: String(inp?.unit || '').trim()
    }));

    for (const inp of normalizedInputs) {
      if (!inp.ingredientName) throw badRequest('Cada insumo es requerido.');
      if (!inp.quantity || inp.quantity <= 0) throw badRequest(`La cantidad de "${toDisplayLabel(inp.ingredientName)}" debe ser mayor a 0.`);
      if (!inp.unit) throw badRequest(`La unidad de "${toDisplayLabel(inp.ingredientName)}" es requerida.`);
      if (inp.ingredientName === stockItemName) throw badRequest('Un producto no puede ser insumo de sí mismo.');
    }

    // --- Los insumos solo pueden ser materia prima o insumo listo ---
    const inputItems = await Inventory.find({ name: { $in: normalizedInputs.map((i) => i.ingredientName) } });
    const inputItemByName = new Map(inputItems.map((i) => [i.name, i]));

    for (const inp of normalizedInputs) {
      const item = inputItemByName.get(inp.ingredientName);
      if (!item) {
        throw badRequest(`"${toDisplayLabel(inp.ingredientName)}" no existe en el catálogo. Regístralo primero como Materia Prima o Insumo Listo en Compras.`);
      }
      if (item.itemType === ITEM_TYPES.PRODUCTO_TERMINADO) {
        throw badRequest(`"${item.displayLabel || toDisplayLabel(item.name)}" es un Producto Terminado y no puede usarse como insumo de otra transformación. Solo entran Materia Prima e Insumo Listo.`);
      }
    }

    // --- Fase 1: planear sin escribir (materia prima = lotes de Compra) ---
    const rawPlans = [];
    for (const inp of normalizedInputs) {
      const item = inputItemByName.get(inp.ingredientName);
      if (item.itemType === ITEM_TYPES.MATERIA_PRIMA) {
        try {
          rawPlans.push({ input: inp, item, plan: await planPurchaseConsumption(inp.ingredientName, inp.quantity, inp.unit) });
          continue;
        } catch (lotError) {
          // Materia prima con existencia anterior al sistema de lotes (entró
          // por Entradas viejas): se permite consumirla contra Stock, con el
          // último costo unitario conocido, en vez de bloquear la producción.
          let neededInStoredUnit = inp.quantity;
          try {
            neededInStoredUnit = roundQty(convertBetweenUnits(inp.quantity, inp.unit, item.unit));
          } catch (conversionError) {
            throw lotError;
          }
          if (Number(item.stock || 0) + 0.001 < neededInStoredUnit) throw lotError;
          rawPlans.push({ input: inp, item, plan: null, neededInStoredUnit, fromLegacyStock: true });
          continue;
        }
      }
      {
        // Insumo listo: ya está acreditado a Stock, se valida contra existencia.
        let neededInStoredUnit = inp.quantity;
        try {
          neededInStoredUnit = roundQty(convertBetweenUnits(inp.quantity, inp.unit, item.unit));
        } catch (conversionError) {
          throw badRequest(`La unidad "${inp.unit}" no es compatible con "${item.displayLabel || toDisplayLabel(item.name)}" (se mide en ${item.unit}).`);
        }
        if (Number(item.stock || 0) + 0.001 < neededInStoredUnit) {
          throw badRequest(`No hay suficiente "${item.displayLabel || toDisplayLabel(item.name)}" en Stock. Necesitas ${neededInStoredUnit} ${item.unit} y hay ${roundQty(item.stock)} ${item.unit}.`);
        }
        rawPlans.push({ input: inp, item, plan: null, neededInStoredUnit });
      }
    }

    // --- Fase 2: comprometer consumo y armar el detalle de costo ---
    const rawInputs = [];
    for (const entry of rawPlans) {
      if (entry.plan) {
        await commitPurchaseConsumption(entry.plan);
        rawInputs.push(...entry.plan.consumed);
      } else {
        const fifo = entry.fromLegacyStock
          ? null
          : await consumeFifoBatches(entry.item.name, entry.neededInStoredUnit, entry.item.unit);
        if (fifo && fifo.sourceAllocations.length > 0) {
          fifo.sourceAllocations.forEach((u) => {
            rawInputs.push({
              sourceAllocation: u.allocation,
              ingredientName: entry.item.name,
              quantityUsed: u.quantityConsumed,
              unit: u.unit,
              cost: roundMoney(u.cost ?? (u.quantityConsumed * u.costPerUnit))
            });
          });
        } else {
          const unitCost = await getFallbackUnitCost(entry.item.name, entry.item.unit);
          rawInputs.push({
            ingredientName: entry.item.name,
            quantityUsed: entry.neededInStoredUnit,
            unit: entry.item.unit,
            cost: roundMoney(entry.neededInStoredUnit * unitCost)
          });
        }
      }
    }

    const inheritedCost = roundMoney(rawInputs.reduce((sum, r) => sum + r.cost, 0));
    const costPerProducedUnit = roundMoney(inheritedCost / producedQuantity);

    // --- Merma real del lote ---
    // Entra X, sale Y: la diferencia es lo que se descartó al picar, pelar,
    // desvenar o cocinar. Solo se calcula cuando todos los insumos son
    // convertibles a la unidad producida (no se puede restar und contra g).
    let totalInputQuantity = 0;
    let mermaCalculable = true;
    for (const r of rawInputs) {
      try {
        totalInputQuantity += convertBetweenUnits(r.quantityUsed, r.unit, producedUnit);
      } catch (conversionError) {
        mermaCalculable = false;
        break;
      }
    }
    const mermaQuantity = mermaCalculable ? roundQty(totalInputQuantity - producedQuantity) : null;
    const mermaPct = mermaCalculable && totalInputQuantity > 0
      ? Math.round((mermaQuantity / totalInputQuantity) * 10000) / 100
      : null;

    const allocation = await PurchaseAllocation.create({
      rawInputs,
      stockItemName,
      producedQuantity,
      producedUnit,
      remainingQuantity: producedQuantity,
      inheritedCost,
      costPerProducedUnit,
      processNames: resolvedProcesses,
      recipe: recipe?._id || null,
      recipeName: recipe?.displayLabel || recipe?.name || '',
      totalInputQuantity: mermaCalculable ? roundQty(totalInputQuantity) : null,
      mermaQuantity,
      mermaPct,
      isPassThrough: false,
      allocationDate: req.body.allocationDate || Date.now(),
      userId: req.user?._id,
      userName: req.user?.name,
      notes: req.body.notes || ''
    });

    // --- Descontar de Stock lo que entró (así la merma queda visible) ---
    const processLabel = resolvedProcesses.map((p) => TRANSFORMATION_PROCESS_MAP[p]?.label || p).join(' + ');
    for (const entry of rawPlans) {
      await debitInputStock({
        ingredientName: entry.item.name,
        quantity: entry.input.quantity,
        unit: entry.input.unit,
        actor: req.user,
        reason: `Consumo en producción (${processLabel}) → ${toDisplayLabel(stockItemName)} | Lote ${allocation._id}`
      });
    }

    // --- Acreditar el producto terminado a Stock ---
    let stockCredit = null;
    try {
      stockCredit = await creditStock({
        stockItemName,
        quantity: producedQuantity,
        unit: producedUnit,
        totalCost: inheritedCost,
        actor: req.user,
        itemType: ITEM_TYPES.PRODUCTO_TERMINADO,
        reason: `Producción (${processLabel})${recipe ? ` · receta ${recipe.displayLabel || recipe.name}` : ''}: ${rawInputs.map((r) => `${r.quantityUsed} ${r.unit} ${toDisplayLabel(r.ingredientName)}`).join(' + ')} → ${producedQuantity} ${producedUnit} de ${toDisplayLabel(stockItemName)} | Costo Total Q${inheritedCost}${mermaQuantity !== null ? ` | Merma ${mermaQuantity} ${producedUnit} (${mermaPct}%)` : ''} | Lote ${allocation._id}`
      });
    } catch (creditError) {
      console.error('[createProductionBatch] Error acreditando stock del producto terminado:', creditError.message);
      stockCredit = { error: creditError.message || 'No se pudo acreditar el stock automáticamente.' };
    }

    // --- Guardar la configuración como receta, si se pidió ---
    let savedRecipe = null;
    if (req.body.saveAsRecipe) {
      const recipeName = normalize(req.body.recipeNameToSave || `${stockItemName} — ${resolvedProcesses.join(' + ')}`);
      const existingRecipe = await Recipe.findOne({ name: recipeName });
      const payload = {
        displayLabel: req.body.recipeNameToSave ? String(req.body.recipeNameToSave).trim() : `${toDisplayLabel(stockItemName)} (${processLabel})`,
        outputItemName: stockItemName,
        outputUnit: producedUnit,
        expectedYield: producedQuantity,
        inputs: normalizedInputs.map((inp) => ({
          itemName: inp.ingredientName,
          itemType: inputItemByName.get(inp.ingredientName)?.itemType || ITEM_TYPES.MATERIA_PRIMA,
          quantity: inp.quantity,
          unit: inp.unit
        })),
        processNames: resolvedProcesses,
        notes: req.body.notes || '',
        createdByName: req.user?.name || ''
      };
      savedRecipe = existingRecipe
        ? await Recipe.findByIdAndUpdate(existingRecipe._id, payload, { new: true })
        : await Recipe.create({ name: recipeName, ...payload });

      if (!outputItem.defaultRecipe) {
        outputItem.defaultRecipe = savedRecipe._id;
        await outputItem.save();
      }
    }

    return res.status(200).json({
      message: 'Lote de producción registrado exitosamente',
      allocation,
      stockCredit,
      merma: { quantity: mermaQuantity, pct: mermaPct, unit: producedUnit, totalInput: mermaCalculable ? roundQty(totalInputQuantity) : null },
      recipe: savedRecipe
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message || 'Error creating production batch' });
  }
};
