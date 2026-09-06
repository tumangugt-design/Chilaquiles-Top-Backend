import Purchase from './purchase.model.js';
import PurchaseAllocation from './purchase-allocation.model.js';
import { planPurchaseConsumption, commitPurchaseConsumption } from './purchase.service.js';

const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100;
const roundQty = (value) => Math.round(Number(value || 0) * 1000) / 1000;

// GET /api/purchases
// Lista las Compras (lotes en bruto). Filtro opcional ?ingredientName=cebolla
export const getPurchases = async (req, res) => {
  try {
    const filter = {};
    if (req.query.ingredientName) {
      filter.ingredientName = String(req.query.ingredientName).trim().toLowerCase();
    }
    const purchases = await Purchase.find(filter)
      .populate('supplier', 'name')
      .sort({ purchaseDate: -1 });
    return res.status(200).json(purchases);
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching purchases', error: error.message });
  }
};

// POST /api/purchases
// Registra una Compra en bruto. remainingQuantity arranca igual a quantity.
export const createPurchase = async (req, res) => {
  try {
    const ingredientName = String(req.body.ingredientName || '').trim().toLowerCase();
    const quantity = Number(req.body.quantity);
    const unit = String(req.body.unit || '').trim();
    const totalCost = Number(req.body.totalCost);

    if (!ingredientName) {
      return res.status(400).json({ message: 'El nombre del ingrediente es requerido.' });
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

    const purchase = await Purchase.create({
      ingredientName,
      quantity: roundQty(quantity),
      unit,
      remainingQuantity: roundQty(quantity),
      totalCost: roundMoney(totalCost),
      supplier: req.body.supplier || null,
      contactName: req.body.contactName || '',
      purchaseDate: req.body.purchaseDate || Date.now(),
      notes: req.body.notes || ''
    });

    return res.status(200).json({ message: 'Compra registrada exitosamente', purchase });
  } catch (error) {
    return res.status(500).json({ message: 'Error creating purchase', error: error.message });
  }
};

// GET /api/purchases/:id/allocations
// Historial de lotes de produccion que tomaron (al menos en parte) de ESTA
// Compra especifica. Cada allocation puede tener otros ingredientes ademas
// de este (rawInputs), por eso el front resalta solo la entrada de este lote.
export const getPurchaseAllocations = async (req, res) => {
  try {
    const allocations = await PurchaseAllocation.find({ 'rawInputs.purchase': req.params.id }).sort({ allocationDate: -1 });
    return res.status(200).json(allocations);
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching allocations', error: error.message });
  }
};

// GET /api/purchases/allocations?stockItemName=salsa+roja
// Historial de lotes de produccion que alimentaron un producto de Stock especifico.
export const getAllocationsByStockItem = async (req, res) => {
  try {
    const stockItemName = String(req.query.stockItemName || '').trim().toLowerCase();
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

// POST /api/purchases/production-batches
// Produce un lote de un producto de Stock a partir de uno o mas ingredientes
// en bruto (cada uno consumido FIFO de sus propios lotes de Compra). Cubre
// tanto el caso simple (un solo ingrediente, ej. cebolla -> cebolla
// caramelizada) como el compuesto (varios ingredientes que se combinan y ya
// no se pueden separar, ej. salsa = tomate + cebolla + chile -> litros de salsa).
//
// El costo se calcula UNA VEZ, sumando lo que costo cada ingrediente segun
// el/los lote(s) de Compra de los que salio, y se congela (inheritedCost /
// costPerProducedUnit) - nunca se recalcula despues.
export const createProductionBatch = async (req, res) => {
  try {
    const stockItemName = String(req.body.stockItemName || '').trim().toLowerCase();
    const producedQuantity = roundQty(Number(req.body.producedQuantity));
    const producedUnit = String(req.body.producedUnit || '').trim();
    const inputs = Array.isArray(req.body.inputs) ? req.body.inputs : [];

    if (!stockItemName) {
      return res.status(400).json({ message: 'El producto de Stock resultante es requerido.' });
    }
    if (!producedQuantity || producedQuantity <= 0) {
      return res.status(400).json({ message: 'El rendimiento (cantidad producida) debe ser mayor a 0.' });
    }
    if (!producedUnit) {
      return res.status(400).json({ message: 'La unidad del producto transformado es requerida.' });
    }
    if (inputs.length === 0) {
      return res.status(400).json({ message: 'Agrega al menos un ingrediente en bruto.' });
    }

    const normalizedInputs = inputs.map((inp) => ({
      ingredientName: String(inp?.ingredientName || '').trim().toLowerCase(),
      quantity: roundQty(Number(inp?.quantity)),
      unit: String(inp?.unit || '').trim()
    }));

    for (const inp of normalizedInputs) {
      if (!inp.ingredientName) {
        return res.status(400).json({ message: 'Cada ingrediente en bruto es requerido.' });
      }
      if (!inp.quantity || inp.quantity <= 0) {
        return res.status(400).json({ message: `La cantidad de "${inp.ingredientName}" debe ser mayor a 0.` });
      }
      if (!inp.unit) {
        return res.status(400).json({ message: `La unidad de "${inp.ingredientName}" es requerida.` });
      }
    }

    // Fase 1: planear el consumo FIFO de CADA ingrediente sin escribir nada
    // todavia - si alguno no alcanza, no se descuenta nada de ningun lote.
    const plans = [];
    for (const inp of normalizedInputs) {
      const plan = await planPurchaseConsumption(inp.ingredientName, inp.quantity, inp.unit);
      plans.push(plan);
    }

    // Fase 2: ya validado todo, se comprometen los descuentos y se arma el
    // detalle de rawInputs con lo que realmente salio de cada lote.
    const rawInputs = [];
    for (const plan of plans) {
      await commitPurchaseConsumption(plan);
      rawInputs.push(...plan.consumed);
    }

    const inheritedCost = roundMoney(rawInputs.reduce((sum, r) => sum + r.cost, 0));
    const costPerProducedUnit = roundMoney(inheritedCost / producedQuantity);

    const allocation = await PurchaseAllocation.create({
      rawInputs,
      stockItemName,
      producedQuantity,
      producedUnit,
      remainingQuantity: producedQuantity,
      inheritedCost,
      costPerProducedUnit,
      allocationDate: req.body.allocationDate || Date.now(),
      userId: req.user?._id,
      userName: req.user?.name,
      notes: req.body.notes || ''
    });

    return res.status(200).json({ message: 'Lote de producción registrado exitosamente', allocation });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message || 'Error creating production batch' });
  }
};
