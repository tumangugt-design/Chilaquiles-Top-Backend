import Inventory from './inventory.model.js';
import Portion from './portion.model.js';
import Recipe from './recipe.model.js';
import TransformationProcess from './transformation-process.model.js';
import PurchaseAllocation from '../purchases/purchase-allocation.model.js';
import { seedInventory } from './inventory.service.js';
import { ensureInventoryItem, catalogUnitFor } from '../purchases/stock-credit.service.js';
import { ITEM_TYPES, ITEM_TYPE_LABELS, toDisplayLabel } from '../helpers/constants.js';

const normalize = (value = '') => String(value || '').trim().toLowerCase();
const roundQty = (value) => Math.round(Number(value || 0) * 1000) / 1000;

// ---------------------------------------------------------------------------
// PROCESOS DE TRANSFORMACION
// Todo producto terminado tiene proceso asignado, tenga o no receta: el
// proceso es donde se registra la merma (picado, pelado, desvenado...).
// ---------------------------------------------------------------------------
export const getTransformationProcesses = async (req, res) => {
  try {
    const processes = await TransformationProcess.find({ isActive: { $ne: false } }).sort({ name: 1 });
    return res.status(200).json(processes);
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching processes', error: error.message });
  }
};

export const saveTransformationProcess = async (req, res) => {
  try {
    const name = normalize(req.body.name);
    if (!name) return res.status(400).json({ message: 'El nombre del proceso es requerido.' });

    const payload = {
      displayLabel: String(req.body.displayLabel || req.body.name).trim(),
      description: String(req.body.description || '').trim(),
      expectedLossPct: Number(req.body.expectedLossPct || 0)
    };

    const existing = await TransformationProcess.findOne({ name });
    const process = existing
      ? await TransformationProcess.findByIdAndUpdate(existing._id, payload, { new: true })
      : await TransformationProcess.create({ name, ...payload });

    return res.status(200).json({ message: 'Proceso guardado', process });
  } catch (error) {
    return res.status(500).json({ message: 'Error saving process', error: error.message });
  }
};

// ---------------------------------------------------------------------------
// RECETAS
// Una receta no es mas que una configuracion de transformacion guardada, y
// siempre corresponde a UN producto terminado.
// ---------------------------------------------------------------------------
export const getRecipes = async (req, res) => {
  try {
    const filter = { isActive: { $ne: false } };
    if (req.query.outputItemName) filter.outputItemName = normalize(req.query.outputItemName);
    const recipes = await Recipe.find(filter).sort({ outputItemName: 1, name: 1 });

    // Merma esperada de la receta: lo que entra menos lo que deberia salir.
    const withMerma = recipes.map((r) => {
      const obj = r.toObject();
      obj.displayLabel = r.displayLabel || toDisplayLabel(r.name);
      obj.outputDisplayLabel = toDisplayLabel(r.outputItemName);
      return obj;
    });

    return res.status(200).json(withMerma);
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching recipes', error: error.message });
  }
};

export const saveRecipe = async (req, res) => {
  try {
    const outputItemName = normalize(req.body.outputItemName);
    const outputUnit = String(req.body.outputUnit || '').trim();
    const expectedYield = roundQty(Number(req.body.expectedYield));
    const inputs = Array.isArray(req.body.inputs) ? req.body.inputs : [];
    const processNames = (Array.isArray(req.body.processNames) ? req.body.processNames : [req.body.processName])
      .map(normalize)
      .filter(Boolean);

    if (!outputItemName) return res.status(400).json({ message: 'El producto terminado resultante es requerido.' });
    if (!outputUnit) return res.status(400).json({ message: 'La unidad del producto terminado es requerida.' });
    if (!expectedYield || expectedYield <= 0) return res.status(400).json({ message: 'El rendimiento esperado debe ser mayor a 0.' });
    if (inputs.length === 0) return res.status(400).json({ message: 'La receta debe tener al menos un insumo.' });
    if (processNames.length === 0) {
      return res.status(400).json({ message: 'Selecciona el proceso de transformación de la receta (picado, licuado, cocido...).' });
    }

    // El resultado de una receta siempre es producto terminado.
    let outputItem = await Inventory.findOne({ name: outputItemName });
    if (outputItem && outputItem.itemType !== ITEM_TYPES.PRODUCTO_TERMINADO) {
      return res.status(400).json({
        message: `"${outputItem.displayLabel || toDisplayLabel(outputItemName)}" está registrado como ${ITEM_TYPE_LABELS[outputItem.itemType] || outputItem.itemType}. Una receta solo puede producir un Producto Terminado.`
      });
    }
    if (!outputItem) {
      outputItem = await ensureInventoryItem({
        name: outputItemName,
        itemType: ITEM_TYPES.PRODUCTO_TERMINADO,
        unit: catalogUnitFor(outputUnit),
        category: 'Otros',
        processName: processNames[0]
      });
    }

    // Los insumos solo pueden ser materia prima o insumo listo.
    const normalizedInputs = [];
    for (const inp of inputs) {
      const itemName = normalize(inp?.itemName || inp?.ingredientName);
      const quantity = roundQty(Number(inp?.quantity));
      const unit = String(inp?.unit || '').trim();
      if (!itemName) return res.status(400).json({ message: 'Cada insumo de la receta necesita nombre.' });
      if (!quantity || quantity <= 0) return res.status(400).json({ message: `La cantidad de "${toDisplayLabel(itemName)}" debe ser mayor a 0.` });
      if (!unit) return res.status(400).json({ message: `La unidad de "${toDisplayLabel(itemName)}" es requerida.` });

      const item = await Inventory.findOne({ name: itemName });
      if (!item) {
        return res.status(400).json({ message: `"${toDisplayLabel(itemName)}" no existe en el catálogo. Regístralo primero como Materia Prima o Insumo Listo.` });
      }
      if (item.itemType === ITEM_TYPES.PRODUCTO_TERMINADO) {
        return res.status(400).json({ message: `"${item.displayLabel || toDisplayLabel(itemName)}" es un Producto Terminado y no puede ser insumo de una receta.` });
      }
      normalizedInputs.push({ itemName, itemType: item.itemType, quantity, unit });
    }

    const name = normalize(req.body.name || `${outputItemName} — ${processNames.join(' + ')}`);
    const payload = {
      displayLabel: String(req.body.displayLabel || req.body.name || `${toDisplayLabel(outputItemName)} (${processNames.join(' + ')})`).trim(),
      outputItemName,
      outputUnit,
      expectedYield,
      inputs: normalizedInputs,
      processNames,
      notes: String(req.body.notes || '').trim(),
      createdByName: req.user?.name || ''
    };

    const existing = req.params.id
      ? await Recipe.findById(req.params.id)
      : await Recipe.findOne({ name });

    const recipe = existing
      ? await Recipe.findByIdAndUpdate(existing._id, payload, { new: true })
      : await Recipe.create({ name, ...payload });

    if (!outputItem.defaultRecipe) {
      outputItem.defaultRecipe = recipe._id;
      await outputItem.save();
    }
    if (!outputItem.processName) {
      outputItem.processName = processNames[0];
      await outputItem.save();
    }

    return res.status(200).json({ message: 'Receta guardada', recipe });
  } catch (error) {
    return res.status(500).json({ message: 'Error saving recipe', error: error.message });
  }
};

export const deleteRecipe = async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) return res.status(404).json({ message: 'Receta no encontrada' });
    await Inventory.updateMany({ defaultRecipe: recipe._id }, { $set: { defaultRecipe: null } });
    await Recipe.findByIdAndDelete(recipe._id);
    return res.status(200).json({ message: 'Receta eliminada' });
  } catch (error) {
    return res.status(500).json({ message: 'Error deleting recipe', error: error.message });
  }
};

// Quita la porcion por plato de un producto SIN borrar el producto.
// Un producto puede existir en Stock y no consumirse por plato (ej. Picante
// mientras no se decida cuanto lleva). Tambien sirve para limpiar porciones
// huerfanas que quedaron de configuraciones viejas.
export const deletePortion = async (req, res) => {
  try {
    const name = normalize(req.params.name);
    const portion = await Portion.findOne({ name });
    if (!portion) {
      return res.status(404).json({ message: 'Esa porción no existe.' });
    }
    await Portion.deleteOne({ _id: portion._id });
    const stillInStock = await Inventory.exists({ name });
    return res.status(200).json({
      message: stillInStock
        ? `"${toDisplayLabel(name)}" ya no se consume por plato. Sigue existiendo en Stock.`
        : `Porción "${toDisplayLabel(name)}" eliminada.`
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error deleting portion', error: error.message });
  }
};

// ---------------------------------------------------------------------------
// SEED / NORMALIZACION DEL CATALOGO MAESTRO
// Idempotente: alinea tipo, etiqueta, categoria, unidad y proceso de todo el
// catalogo con helpers/constants.js. Se corre solo al arrancar el servidor y
// se puede volver a disparar desde el admin cuando se agregan productos.
// ---------------------------------------------------------------------------
export const seedCatalog = async (req, res) => {
  try {
    const report = await seedInventory({ silent: true });
    const counts = await Inventory.aggregate([
      { $group: { _id: '$itemType', total: { $sum: 1 } } }
    ]);
    return res.status(200).json({
      message: 'Catálogo normalizado',
      report,
      totalsByType: counts.reduce((acc, c) => ({ ...acc, [c._id || 'SIN_TIPO']: c.total }), {})
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error seeding catalog', error: error.message });
  }
};

// Resumen de merma por producto terminado — insumo del costeo por producción.
export const getMermaSummary = async (req, res) => {
  try {
    const summary = await PurchaseAllocation.aggregate([
      { $match: { isPassThrough: { $ne: true }, mermaQuantity: { $ne: null } } },
      {
        $group: {
          _id: '$stockItemName',
          lotes: { $sum: 1 },
          totalInput: { $sum: '$totalInputQuantity' },
          totalProducido: { $sum: '$producedQuantity' },
          totalMerma: { $sum: '$mermaQuantity' },
          costoTotal: { $sum: '$inheritedCost' },
          unidad: { $last: '$producedUnit' },
          ultimoLote: { $max: '$allocationDate' }
        }
      },
      { $sort: { totalMerma: -1 } }
    ]);

    return res.status(200).json(summary.map((row) => ({
      stockItemName: row._id,
      displayLabel: toDisplayLabel(row._id),
      lotes: row.lotes,
      totalInput: Math.round(row.totalInput * 1000) / 1000,
      totalProducido: Math.round(row.totalProducido * 1000) / 1000,
      totalMerma: Math.round(row.totalMerma * 1000) / 1000,
      mermaPct: row.totalInput > 0 ? Math.round((row.totalMerma / row.totalInput) * 10000) / 100 : null,
      costoTotal: Math.round(row.costoTotal * 100) / 100,
      unidad: row.unidad,
      ultimoLote: row.ultimoLote
    })));
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching merma summary', error: error.message });
  }
};
