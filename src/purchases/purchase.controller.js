import Purchase from './purchase.model.js';
import PurchaseAllocation from './purchase-allocation.model.js';

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
      purchaseDate: req.body.purchaseDate || Date.now(),
      notes: req.body.notes || ''
    });

    return res.status(200).json({ message: 'Compra registrada exitosamente', purchase });
  } catch (error) {
    return res.status(500).json({ message: 'Error creating purchase', error: error.message });
  }
};

// GET /api/purchases/:id/allocations
export const getPurchaseAllocations = async (req, res) => {
  try {
    const allocations = await PurchaseAllocation.find({ purchase: req.params.id }).sort({ allocationDate: -1 });
    return res.status(200).json(allocations);
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching allocations', error: error.message });
  }
};

// GET /api/purchases/allocations?stockItemName=cebolla+caramelizada
// Historial de transformaciones que alimentaron un producto de Stock especifico.
export const getAllocationsByStockItem = async (req, res) => {
  try {
    const stockItemName = String(req.query.stockItemName || '').trim().toLowerCase();
    if (!stockItemName) {
      return res.status(400).json({ message: 'stockItemName es requerido' });
    }
    const allocations = await PurchaseAllocation.find({ stockItemName })
      .populate('purchase', 'ingredientName unit purchaseDate')
      .sort({ allocationDate: -1 });
    return res.status(200).json(allocations);
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching allocations', error: error.message });
  }
};

// POST /api/purchases/:id/allocations
// Transforma parte de una Compra en bruto hacia un producto de Stock concreto.
// El costo se calcula UNA VEZ, proporcional al costo total en bruto, y se congela
// (inheritedCost / costPerProducedUnit) - nunca se recalcula despues.
export const createPurchaseAllocation = async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) {
      return res.status(404).json({ message: 'Compra no encontrada' });
    }

    const rawQuantityUsed = roundQty(Number(req.body.rawQuantityUsed));
    const stockItemName = String(req.body.stockItemName || '').trim().toLowerCase();
    const producedQuantity = roundQty(Number(req.body.producedQuantity));
    const producedUnit = String(req.body.producedUnit || '').trim();

    if (!rawQuantityUsed || rawQuantityUsed <= 0) {
      return res.status(400).json({ message: 'La cantidad en bruto usada debe ser mayor a 0.' });
    }
    if (!stockItemName) {
      return res.status(400).json({ message: 'El producto de Stock destino es requerido.' });
    }
    if (!producedQuantity || producedQuantity <= 0) {
      return res.status(400).json({ message: 'El rendimiento (cantidad producida) debe ser mayor a 0.' });
    }
    if (!producedUnit) {
      return res.status(400).json({ message: 'La unidad del producto transformado es requerida.' });
    }
    if (rawQuantityUsed > purchase.remainingQuantity + 0.001) {
      return res.status(400).json({
        message: `No hay suficiente cantidad disponible en este lote. Restante: ${purchase.remainingQuantity} ${purchase.unit}`
      });
    }

    const inheritedCost = roundMoney((rawQuantityUsed / purchase.quantity) * purchase.totalCost);
    const costPerProducedUnit = roundMoney(inheritedCost / producedQuantity);

    const allocation = await PurchaseAllocation.create({
      purchase: purchase._id,
      rawQuantityUsed,
      rawUnit: purchase.unit,
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

    const newRemaining = roundQty(purchase.remainingQuantity - rawQuantityUsed);
    purchase.remainingQuantity = newRemaining <= 0.001 ? 0 : newRemaining;
    purchase.isDepleted = purchase.remainingQuantity <= 0;
    await purchase.save();

    return res.status(200).json({ message: 'Asignación registrada exitosamente', allocation, purchase });
  } catch (error) {
    return res.status(500).json({ message: 'Error creating allocation', error: error.message });
  }
};
