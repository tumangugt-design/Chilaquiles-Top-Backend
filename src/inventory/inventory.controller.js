import Inventory from './inventory.model.js'
import InventoryLog from './inventoryLog.model.js'
import { getAggregatedConsumption, validateInventoryAvailability, manualStockAdjustment, getAvailablePlatesCount } from './inventory.service.js'
import { INVENTORY_CATALOG, INVENTORY_CATALOG_MAP } from '../helpers/constants.js'

const PROTECTED_PACKAGING_NAMES = INVENTORY_CATALOG
  .filter((item) => item.category === 'Empaque')
  .map((item) => item.name)

const isProtectedPackaging = (name = '') => PROTECTED_PACKAGING_NAMES.includes(String(name).trim().toLowerCase())

export const getAvailablePlates = async (req, res) => {
  try {
    const count = await getAvailablePlatesCount()
    return res.status(200).json({ count })
  } catch (error) {
    return res.status(500).json({ message: 'Error calculating available plates', error: error.message })
  }
}


export const getPublicInventoryOptions = async (req, res) => {
  try {
    const items = await Inventory.find({}, 'name stock isActive').sort({ name: 1 })
    const activeNames = items
      .filter((item) => item.isActive !== false && Number(item.stock || 0) > 0)
      .map((item) => item.name)
    return res.status(200).json({ activeNames, items })
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching public inventory options', error: error.message })
  }
}

export const getInventoryItems = async (req, res) => {
  try {
    await Inventory.updateMany(
      { name: { $in: PROTECTED_PACKAGING_NAMES }, isActive: false },
      { $set: { isActive: true } }
    )

    const items = await Inventory.find().sort({ name: 1 })
    return res.status(200).json(items)
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching inventory', error: error.message })
  }
}

export const saveInventoryItem = async (req, res) => {
  try {
    const name = String(req.body.name || '').trim().toLowerCase()
    const amount = Number(req.body.amount ?? req.body.stock ?? 0)
    const catalogItem = INVENTORY_CATALOG_MAP[name]

    if (!catalogItem) {
      return res.status(400).json({ message: 'Producto no permitido en inventario.' })
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'La cantidad debe ser mayor que cero.' })
    }

    let inventoryItem = await Inventory.findOne({ name })
    if (!inventoryItem) {
      inventoryItem = await Inventory.create({
        name,
        unit: catalogItem.unit,
        stock: 0,
        minimumStock: 5
      })
    }

    const item = await manualStockAdjustment({
      name,
      amount,
      type: 'IN',
      price: Number(req.body.price || 0),
      actor: req.user,
      reason: 'Entrada de inventario'
    })

    return res.status(200).json({ message: 'Entrada de inventario registrada', item })
  } catch (error) {
    return res.status(500).json({ message: 'Error saving inventory item', error: error.message })
  }
}

export const previewRecipeConsumption = async (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : []
    const validation = await validateInventoryAvailability(items)
    return res.status(200).json({
      consumption: getAggregatedConsumption(items),
      validation,
      futurePhase: 'Ready for detailed recipe breakdown per plate and sub-ingredient.'
    })
  } catch (error) {
    return res.status(500).json({ message: 'Error generating recipe preview', error: error.message })
  }
}

export const deleteInventoryItem = async (req, res) => {
  try {
    const { name } = req.params
    await Inventory.findOneAndDelete({ name: name.toLowerCase() })
    return res.status(200).json({ message: 'Item deleted from inventory' })
  } catch (error) {
    return res.status(500).json({ message: 'Error deleting item', error: error.message })
  }
}

export const adjustInventoryStock = async (req, res) => {
  try {
    const { name } = req.params
    const { amount, reason, type } = req.body

    const item = await manualStockAdjustment({
      name,
      amount: Number(amount),
      type,
      price: Number(req.body.price || 0),
      actor: req.user,
      reason
    })

    return res.status(200).json({ message: 'Stock adjusted successfully', item })
  } catch (error) {
    return res.status(500).json({ message: 'Error adjusting stock', error: error.message })
  }
}

export const getInventoryLogs = async (req, res) => {
  try {
    const { ingredientId, type, limit = 50 } = req.query
    const query = {}
    if (ingredientId) query.ingredient = ingredientId
    if (type) query.type = type

    const logs = await InventoryLog.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .populate('userId', 'name email')

    return res.status(200).json(logs)
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching inventory logs', error: error.message })
  }
}

export const toggleInventoryItemStatus = async (req, res) => {
  try {
    const { name } = req.params;
    const { isActive } = req.body;
    const normalizedName = String(name || '').trim().toLowerCase();

    if (isProtectedPackaging(normalizedName) && isActive === false) {
      const item = await Inventory.findOneAndUpdate(
        { name: normalizedName },
        { isActive: true },
        { new: true }
      );

      return res.status(400).json({
        message: 'Los productos de empaque son obligatorios y no se pueden desactivar.',
        item
      });
    }
    
    const item = await Inventory.findOneAndUpdate(
      { name: normalizedName },
      { isActive: !!isActive },
      { new: true }
    );
    
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }
    
    return res.status(200).json({ message: 'Item status updated', item });
  } catch (error) {
    return res.status(500).json({ message: 'Error updating item status', error: error.message });
  }
}

export const syncInventory = async (req, res) => {
  try {
    const { seedInventory } = await import('./inventory.service.js');
    await seedInventory();
    return res.status(200).json({ message: 'Inventario sincronizado exitosamente' });
  } catch (error) {
    return res.status(500).json({ message: 'Error sincronizando inventario', error: error.message });
  }
}
