import Inventory from './inventory.model.js'
import InventoryLog from './inventoryLog.model.js'
import { getAggregatedConsumption, validateInventoryAvailability, manualStockAdjustment, getAvailablePlatesCount, convertAmountToCatalogUnit } from './inventory.service.js'
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


const getRequiredStockForPublicOption = (item) => {
  const catalogItem = INVENTORY_CATALOG_MAP[item.name]
  return Number(catalogItem?.usedPerPlate || 1)
}

export const getPublicInventoryOptions = async (req, res) => {
  try {
    const items = await Inventory.find({}, 'name stock unit category isActive').sort({ name: 1 })

    const publicItems = items.map((item) => {
      const required = getRequiredStockForPublicOption(item)
      const stock = Number(item.stock || 0)
      const isActive = item.isActive !== false
      const hasEnoughStock = stock >= required
      const availabilityStatus = !isActive ? 'inactive' : hasEnoughStock ? 'available' : 'insufficient'

      return {
        _id: item._id,
        name: item.name,
        stock,
        unit: item.unit,
        category: item.category,
        isActive,
        required,
        available: isActive && hasEnoughStock,
        availabilityStatus
      }
    })

    const activeNames = publicItems
      .filter((item) => item.available)
      .map((item) => item.name)

    return res.status(200).json({ activeNames, items: publicItems })
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
    const rawAmount = Number(req.body.amount ?? req.body.stock ?? 0)
    const catalogItem = INVENTORY_CATALOG_MAP[name]

    if (!catalogItem) {
      return res.status(400).json({ message: 'Producto no permitido en inventario.' })
    }

    const inputUnit = catalogItem.category === 'Empaque' ? 'und' : (req.body.inputUnit || req.body.unit || catalogItem.unit)
    const amount = convertAmountToCatalogUnit(rawAmount, inputUnit, catalogItem.unit)

    const rawPrice = req.body.totalPrice ?? req.body.price
    const hasPrice = rawPrice !== undefined && rawPrice !== null && rawPrice !== ''
    const totalPrice = hasPrice ? Number(rawPrice) : undefined

    if (hasPrice && (Number.isNaN(totalPrice) || totalPrice < 0)) {
      return res.status(400).json({ message: 'El costo total debe ser un número válido mayor o igual a cero.' })
    }

    let fixedPrice = undefined
    if (hasPrice) {
      if (amount > 0) {
        const usedPerPlate = catalogItem.usedPerPlate || 1
        const portionPrice = (totalPrice / amount) * usedPerPlate
        fixedPrice = Math.round(portionPrice * 100) / 100
      } else {
        fixedPrice = Math.round(totalPrice * 100) / 100
      }
    }

    let inventoryItem = await Inventory.findOne({ name })
    if (!inventoryItem) {
      inventoryItem = await Inventory.create({
        name,
        unit: catalogItem.unit,
        category: catalogItem.category || 'Otros',
        stock: 0,
        minimumStock: 5,
        isActive: true
      })
    }

    const item = await manualStockAdjustment({
      name,
      amount,
      type: 'IN',
      price: fixedPrice,
      actor: req.user,
      reason: `Entrada de inventario: ${rawAmount} ${inputUnit} → ${amount} ${catalogItem.unit}${hasPrice ? ` | Costo Total Q${totalPrice} (Porción por plato Q${fixedPrice})` : ''}`
    })

    // Store raw purchase data directly on the Inventory document for reliable retrieval
    await Inventory.findOneAndUpdate(
      { name },
      {
        lastPurchaseQty: rawAmount,
        lastPurchaseUnit: inputUnit,
        lastPurchaseTotalPrice: hasPrice ? totalPrice : null
      }
    )

    return res.status(200).json({
      message: 'Entrada de inventario registrada',
      item,
      conversion: { inputAmount: rawAmount, inputUnit, storedAmount: amount, storedUnit: catalogItem.unit, fixedPrice }
    })
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message || 'Error saving inventory item', error: error.message })
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


export const updateInventoryItemStock = async (req, res) => {
  try {
    const normalizedName = String(req.params.name || '').trim().toLowerCase()
    const rawStock = Number(req.body.stock)
    const catalogItem = INVENTORY_CATALOG_MAP[normalizedName]

    if (!catalogItem) {
      return res.status(400).json({ message: 'Producto no permitido en inventario.' })
    }

    if (Number.isNaN(rawStock) || rawStock < 0) {
      return res.status(400).json({ message: 'El stock debe ser un número válido mayor o igual a cero.' })
    }

    const inputUnit = catalogItem.category === 'Empaque' ? 'und' : (req.body.inputUnit || req.body.unit || catalogItem.unit)
    const nextStock = convertAmountToCatalogUnit(rawStock, inputUnit, catalogItem.unit)

    let item = await Inventory.findOne({ name: normalizedName })
    if (!item) {
      item = await Inventory.create({
        name: normalizedName,
        unit: catalogItem.unit,
        category: catalogItem.category || 'Otros',
        stock: 0,
        minimumStock: 5,
        isActive: true
      })
    }

    const previousStock = Number(item.stock || 0)

    item.unit = catalogItem.unit
    item.category = catalogItem.category || item.category || 'Otros'
    item.stock = nextStock
    if (catalogItem.category === 'Empaque') item.isActive = true
    await item.save()

    if (previousStock !== nextStock) {
      await InventoryLog.create({
        ingredient: item._id,
        ingredientName: item.name,
        type: 'ADJUSTMENT',
        amount: Math.abs(nextStock - previousStock),
        previousStock,
        newStock: nextStock,
        userId: req.user?._id,
        userName: req.user?.name,
        reason: req.body.reason || `Edición directa de stock: ${rawStock} ${inputUnit} → ${nextStock} ${catalogItem.unit}`
      })
    }

    return res.status(200).json({
      message: 'Stock actualizado correctamente',
      item,
      conversion: { inputAmount: rawStock, inputUnit, storedAmount: nextStock, storedUnit: catalogItem.unit }
    })
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message || 'Error updating item stock', error: error.message })
  }
}


export const updateInventoryItemPrice = async (req, res) => {
  try {
    const normalizedName = String(req.params.name || '').trim().toLowerCase()
    const price = Number(req.body.price)
    const catalogItem = INVENTORY_CATALOG_MAP[normalizedName]

    if (!catalogItem) {
      return res.status(400).json({ message: 'Producto no permitido en inventario.' })
    }

    if (Number.isNaN(price) || price < 0) {
      return res.status(400).json({ message: 'El precio debe ser un número válido mayor o igual a cero.' })
    }

    const item = await Inventory.findOneAndUpdate(
      { name: normalizedName },
      {
        $set: {
          unit: catalogItem.unit,
          category: catalogItem.category || 'Otros',
          lastPrice: price,
          ...(catalogItem.category === 'Empaque' ? { isActive: true } : {})
        },
        $setOnInsert: {
          name: normalizedName,
          stock: 0,
          minimumStock: 5
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )

    return res.status(200).json({ message: 'Precio actualizado correctamente', item })
  } catch (error) {
    return res.status(500).json({ message: 'Error updating item price', error: error.message })
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

const normalizeEntryUnitForUi = (unit = '') => {
  const value = String(unit || '').trim().toLowerCase()
  const unitMap = {
    lbs: 'lb',
    libra: 'lb',
    libras: 'lb',
    lb: 'lb',
    ltrs: 'l',
    litros: 'l',
    litro: 'l',
    lt: 'l',
    l: 'l',
    gramos: 'g',
    gramo: 'g',
    g: 'g',
    unidades: 'und',
    unidad: 'und',
    und: 'und',
    ml: 'ml',
    oz: 'oz'
  }

  return unitMap[value] || value
}

const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100

const deriveTotalPurchasePrice = ({ portionPrice, amount, unit, catalogItem }) => {
  const portion = Number(portionPrice || 0)
  const qty = Number(amount || 0)
  const usedPerPlate = Number(catalogItem?.usedPerPlate || 0)

  if (!portion || !qty || !usedPerPlate || !catalogItem) return null

  try {
    const amountInCatalogUnit = convertAmountToCatalogUnit(qty, unit || catalogItem.unit, catalogItem.unit)
    return roundMoney((portion / usedPerPlate) * amountInCatalogUnit)
  } catch (error) {
    return null
  }
}

export const getLastPurchases = async (req, res) => {
  try {
    const items = await Inventory.find()
    const results = {}

    for (const item of items) {
      const catalogItem = INVENTORY_CATALOG_MAP[item.name]
      if (!catalogItem) continue

      const portionPrice = Number(item.lastPrice || 0)
      const hasDirectPurchaseData = (
        item.lastPurchaseQty !== undefined &&
        item.lastPurchaseQty !== null &&
        item.lastPurchaseUnit
      )

      if (hasDirectPurchaseData) {
        const normalizedUnit = normalizeEntryUnitForUi(item.lastPurchaseUnit)
        const storedTotalPrice = item.lastPurchaseTotalPrice !== undefined && item.lastPurchaseTotalPrice !== null && item.lastPurchaseTotalPrice !== ''
          ? Number(item.lastPurchaseTotalPrice)
          : null
        const derivedTotalPrice = storedTotalPrice !== null
          ? storedTotalPrice
          : deriveTotalPurchasePrice({
              portionPrice,
              amount: item.lastPurchaseQty,
              unit: normalizedUnit,
              catalogItem
            })

        results[item.name] = {
          qty: item.lastPurchaseQty,
          unit: normalizedUnit,
          price: derivedTotalPrice !== null ? roundMoney(derivedTotalPrice) : '',
          portionPrice: portionPrice || 0,
          source: 'inventory'
        }
        continue
      }

      // Fallback para entradas antiguas: leer último log IN.
      const lastLog = await InventoryLog.findOne({
        ingredientName: item.name,
        type: 'IN'
      }).sort({ createdAt: -1 })

      if (!lastLog) {
        if (portionPrice > 0) {
          results[item.name] = {
            qty: '',
            unit: catalogItem.unit,
            price: '',
            portionPrice,
            source: 'inventory-price'
          }
        }
        continue
      }

      const regexWithPrice = /Entrada de inventario:\s*([\d.]+)\s*([a-zA-ZáéíóúÁÉÍÓÚñÑ]+)[^|]*\|\s*Costo Total\s*Q([\d.]+)/i
      const regexNoPrice = /Entrada de inventario:\s*([\d.]+)\s*([a-zA-ZáéíóúÁÉÍÓÚñÑ]+)/i
      const matchWithPrice = lastLog.reason?.match(regexWithPrice)
      const matchNoPrice = lastLog.reason?.match(regexNoPrice)
      const parsedQty = Number(matchWithPrice?.[1] ?? matchNoPrice?.[1] ?? lastLog.amount ?? 0)
      const parsedUnit = normalizeEntryUnitForUi(matchWithPrice?.[2] ?? matchNoPrice?.[2] ?? catalogItem.unit)
      const parsedTotal = matchWithPrice?.[3] ? Number(matchWithPrice[3]) : null
      const logPortionPrice = Number(lastLog.price || portionPrice || 0)
      const derivedTotalPrice = parsedTotal !== null
        ? parsedTotal
        : deriveTotalPurchasePrice({
            portionPrice: logPortionPrice,
            amount: parsedQty,
            unit: parsedUnit,
            catalogItem
          })

      results[item.name] = {
        qty: parsedQty || '',
        unit: parsedUnit || catalogItem.unit,
        price: derivedTotalPrice !== null ? roundMoney(derivedTotalPrice) : '',
        portionPrice: logPortionPrice || 0,
        source: 'log'
      }
    }

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.set('Pragma', 'no-cache')
    res.set('Expires', '0')

    return res.status(200).json(results)
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching last purchases', error: error.message })
  }
}
