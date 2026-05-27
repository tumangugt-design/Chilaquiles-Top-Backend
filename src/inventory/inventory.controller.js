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

    let portionPrice = undefined
    let unitPrice = undefined
    if (hasPrice) {
      if (amount > 0) {
        const usedPerPlate = catalogItem.usedPerPlate || 1
        unitPrice = roundMoney(totalPrice / amount)
        portionPrice = roundMoney((totalPrice / amount) * usedPerPlate)
      } else {
        portionPrice = roundMoney(totalPrice)
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
      totalPrice: hasPrice ? totalPrice : undefined,
      portionPrice,
      inputAmount: rawAmount,
      inputUnit,
      storedUnit: catalogItem.unit,
      actor: req.user,
      reason: `Entrada de inventario: ${rawAmount} ${inputUnit} → ${amount} ${catalogItem.unit}${hasPrice ? ` | Costo Total Q${roundMoney(totalPrice)} | Costo unitario Q${unitPrice || 0}/${catalogItem.unit} | Porción por plato Q${portionPrice}` : ''}`
    })

    // Store raw purchase data directly on the Inventory document for reliable retrieval.
    // Estos campos guardan la compra completa; lastPrice guarda solo el costo de porción por plato.
    await Inventory.findOneAndUpdate(
      { name },
      {
        lastPurchaseQty: rawAmount,
        lastPurchaseUnit: inputUnit,
        lastPurchaseTotalPrice: hasPrice ? roundMoney(totalPrice) : null
      }
    )

    return res.status(200).json({
      message: 'Entrada de inventario registrada',
      item,
      conversion: { inputAmount: rawAmount, inputUnit, storedAmount: amount, storedUnit: catalogItem.unit, totalPrice, unitPrice, portionPrice }
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

const derivePortionPrice = ({ totalPrice, amount, unit, catalogItem }) => {
  const total = Number(totalPrice || 0)
  const qty = Number(amount || 0)
  const usedPerPlate = Number(catalogItem?.usedPerPlate || 0)

  if (!total || !qty || !usedPerPlate || !catalogItem) return 0

  try {
    const amountInCatalogUnit = convertAmountToCatalogUnit(qty, unit || catalogItem.unit, catalogItem.unit)
    if (!amountInCatalogUnit) return 0
    return roundMoney((total / amountInCatalogUnit) * usedPerPlate)
  } catch (error) {
    return 0
  }
}

const buildLastPurchasePayload = ({ qty, unit, totalPrice, portionPrice, source, catalogItem }) => {
  const normalizedUnit = normalizeEntryUnitForUi(unit || catalogItem.unit)
  const numericTotalPrice = totalPrice !== undefined && totalPrice !== null && totalPrice !== '' ? Number(totalPrice) : null
  const portionFromTotal = derivePortionPrice({
    totalPrice: numericTotalPrice,
    amount: qty,
    unit: normalizedUnit,
    catalogItem
  })
  const calculatedPortionPrice = portionFromTotal || Number(portionPrice || 0)

  return {
    qty: qty || '',
    unit: normalizedUnit || catalogItem.unit,
    price: numericTotalPrice !== null && !Number.isNaN(numericTotalPrice) ? roundMoney(numericTotalPrice) : '',
    portionPrice: calculatedPortionPrice || 0,
    source
  }
}

export const getLastPurchases = async (req, res) => {
  try {
    const items = await Inventory.find()
    const results = {}

    for (const item of items) {
      const catalogItem = INVENTORY_CATALOG_MAP[item.name]
      if (!catalogItem) continue

      const itemPortionPrice = Number(item.lastPrice || 0)
      const hasDirectPurchaseData = (
        item.lastPurchaseQty !== undefined &&
        item.lastPurchaseQty !== null &&
        item.lastPurchaseQty !== '' &&
        item.lastPurchaseUnit
      )

      if (hasDirectPurchaseData) {
        results[item.name] = buildLastPurchasePayload({
          qty: Number(item.lastPurchaseQty),
          unit: item.lastPurchaseUnit,
          totalPrice: item.lastPurchaseTotalPrice,
          portionPrice: itemPortionPrice,
          source: 'inventory',
          catalogItem
        })
        continue
      }

      // Fallback para entradas antiguas: leer último log IN.
      const lastLog = await InventoryLog.findOne({
        ingredientName: item.name,
        type: 'IN'
      }).sort({ createdAt: -1 })

      if (!lastLog) {
        if (itemPortionPrice > 0) {
          results[item.name] = {
            qty: '',
            unit: catalogItem.unit,
            price: '',
            portionPrice: itemPortionPrice,
            source: 'inventory-price'
          }
        }
        continue
      }

      // Registros nuevos: campos explícitos para no confundir costo total con costo por porción.
      if (lastLog.inputAmount && lastLog.inputUnit) {
        results[item.name] = buildLastPurchasePayload({
          qty: Number(lastLog.inputAmount),
          unit: lastLog.inputUnit,
          totalPrice: lastLog.totalPrice ?? lastLog.price,
          portionPrice: lastLog.portionPrice || itemPortionPrice,
          source: 'log',
          catalogItem
        })
        continue
      }

      // Registros viejos: se intenta leer el texto del reason si existe.
      const rawReason = lastLog.reason || ''
      const matchQty = rawReason.match(/Entrada de inventario:\s*([\d.]+)\s*([a-zA-ZáéíóúÁÉÍÓÚñÑ]+)/i)
      const matchTotal = rawReason.match(/Costo Total\s*Q\s*([\d.]+)/i)
      const matchPortion = rawReason.match(/Porción por plato\s*Q\s*([\d.]+)/i)

      const qty = Number(matchQty?.[1] ?? lastLog.amount ?? 0)
      const unit = normalizeEntryUnitForUi(matchQty?.[2] ?? catalogItem.unit)

      // En los logs antiguos `price` fue usado como costo total de compra.
      // NO se debe tratar como precio por plato; eso inflaba promociones brutalmente.
      const totalPrice = matchTotal?.[1]
        ? Number(matchTotal[1])
        : (lastLog.totalPrice !== undefined && lastLog.totalPrice !== null ? Number(lastLog.totalPrice) : Number(lastLog.price || 0))

      const portionPrice = matchPortion?.[1]
        ? Number(matchPortion[1])
        : derivePortionPrice({ totalPrice, amount: qty, unit, catalogItem }) || itemPortionPrice

      results[item.name] = buildLastPurchasePayload({
        qty,
        unit,
        totalPrice,
        portionPrice,
        source: 'log',
        catalogItem
      })
    }

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.set('Pragma', 'no-cache')
    res.set('Expires', '0')

    return res.status(200).json(results)
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching last purchases', error: error.message })
  }
}
