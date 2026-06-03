import Inventory from './inventory.model.js'
import InventoryLog from './inventoryLog.model.js'
import Portion from './portion.model.js'
import { DEFAULT_RECIPE_CONSUMPTION, PACKAGING_CONSUMPTION, INVENTORY_CATALOG, INVENTORY_CATALOG_MAP } from '../helpers/constants.js'

const round = (value) => Math.round(value * 1000) / 1000
const normalizeName = (value = '') => value.trim().toLowerCase()

const normalizeUnit = (value = '') => String(value || '').trim().toLowerCase()

const normalizeOptionValue = (value = '') => String(value || '').trim().toUpperCase().replace(/\s+/g, '_')

const normalizeComplementValue = (value = '') => {
  const normalized = normalizeOptionValue(value)
  if (normalized === 'CEBOLLA_CARAMELIZADA') return 'CEBOLLA_CARAMELIZADA'
  if (normalized === 'QUESO_EXTRA') return 'QUESO_EXTRA'
  if (normalized === 'AGUACATE') return 'AGUACATE'
  return normalized
}

const UNIT_ALIASES = {
  g: 'g',
  gramo: 'g',
  gramos: 'g',
  gram: 'g',
  grams: 'g',
  lb: 'lb',
  lbs: 'lb',
  libra: 'lb',
  libras: 'lb',
  oz: 'oz',
  onza: 'oz',
  onzas: 'oz',
  ml: 'ml',
  mililitro: 'ml',
  mililitros: 'ml',
  l: 'l',
  lt: 'l',
  lts: 'l',
  ltr: 'l',
  ltrs: 'l',
  litro: 'l',
  litros: 'l',
  und: 'und',
  unidad: 'und',
  unidades: 'und',
  unit: 'und',
  units: 'und'
}

export const convertAmountToCatalogUnit = (amount, inputUnit, catalogUnit) => {
  const numericAmount = Number(amount)
  if (Number.isNaN(numericAmount) || numericAmount <= 0) {
    const error = new Error('La cantidad debe ser mayor que cero.')
    error.statusCode = 400
    throw error
  }

  const targetUnit = normalizeUnit(catalogUnit)
  const sourceUnit = UNIT_ALIASES[normalizeUnit(inputUnit || catalogUnit)] || normalizeUnit(inputUnit || catalogUnit)

  const conversions = {
    g: { g: 1, lb: 453.59237, oz: 28.349523125 },
    ml: { ml: 1, l: 1000, oz: 29.5735295625 },
    und: { und: 1 }
  }

  const conversionFactor = conversions[targetUnit]?.[sourceUnit]
  if (!conversionFactor) {
    const error = new Error(`La unidad ${inputUnit || catalogUnit} no es compatible con productos medidos en ${catalogUnit}.`)
    error.statusCode = 400
    throw error
  }

  return round(numericAmount * conversionFactor)
}

const getPortionQtyInBaseUnit = (name, portionMap, inventoryMap) => {
  const portion = portionMap[name]
  const inv = inventoryMap[name]
  if (!portion) {
    return DEFAULT_RECIPE_CONSUMPTION[name] || PACKAGING_CONSUMPTION[name] || 0
  }
  const baseUnit = inv?.unit || portion.unit
  if (portion.unit === baseUnit) {
    return portion.usedPerPlate
  }
  try {
    return convertAmountToCatalogUnit(portion.usedPerPlate, portion.unit, baseUnit)
  } catch (err) {
    return portion.usedPerPlate
  }
}

const getConsumptionForItem = (item, portionMap, inventoryMap) => {
  const sauce = normalizeOptionValue(item.sauce)
  const protein = normalizeOptionValue(item.protein)
  const complement = normalizeComplementValue(item.complement)

  const getQty = (name) => getPortionQtyInBaseUnit(name, portionMap, inventoryMap)

  const consumption = {
    totopos: getQty('totopos'),
    queso: getQty('queso'),
  }

  if (sauce === 'ROJA') {
    consumption['salsa roja'] = getQty('salsa roja')
    consumption['plato de 8 onz'] = getQty('plato de 8 onz')
    consumption['tapadera de 8 onz'] = getQty('tapadera de 8 onz')
  } else if (sauce === 'VERDE') {
    consumption['salsa verde'] = getQty('salsa verde')
    consumption['plato de 8 onz'] = getQty('plato de 8 onz')
    consumption['tapadera de 8 onz'] = getQty('tapadera de 8 onz')
  } else if (sauce === 'DIVORCIADOS') {
    consumption['salsa roja'] = round(getQty('salsa roja') / 2)
    consumption['salsa verde'] = round(getQty('salsa verde') / 2)
    consumption['plato de 4 onz'] = getQty('plato de 4 onz')
    consumption['tapadera de 4 onz'] = getQty('tapadera de 4 onz')
  }

  if (protein === 'STEAK') consumption['steak'] = getQty('steak')
  if (protein === 'POLLO') consumption['pollo'] = getQty('pollo')
  if (protein === 'CHORIZO') consumption['chorizo'] = getQty('chorizo')

  if (complement === 'AGUACATE') consumption['aguacate'] = getQty('aguacate')
  if (complement === 'CEBOLLA_CARAMELIZADA') consumption['cebolla caramelizada'] = getQty('cebolla caramelizada')
  if (complement === 'QUESO_EXTRA') consumption['queso extra'] = getQty('queso extra')

  if (item.baseRecipe?.onion) consumption['cebolla'] = getQty('cebolla')
  if (item.baseRecipe?.cilantro) consumption['cilantro'] = getQty('cilantro')
  if (item.baseRecipe?.cream) consumption['crema'] = getQty('crema')

  // Fixed packaging
  const fixedPackagingNames = ['plato rectangular', 'tenedor', 'servilleta', 'sticker']
  fixedPackagingNames.forEach((name) => {
    consumption[name] = getQty(name)
  })

  // Apply packaging overrides if present
  if (item.packagingOverrides && typeof item.packagingOverrides === 'object') {
    Object.entries(item.packagingOverrides).forEach(([name, overrideQty]) => {
      const normalizedOverrideName = name.trim().toLowerCase()
      const val = Number(overrideQty)
      if (!Number.isNaN(val)) {
        if (val > 0) {
          const portion = portionMap[normalizedOverrideName]
          const inv = inventoryMap[normalizedOverrideName]
          if (portion && inv && portion.unit !== inv.unit) {
            try {
              consumption[normalizedOverrideName] = convertAmountToCatalogUnit(val, portion.unit, inv.unit)
            } catch (err) {
              consumption[normalizedOverrideName] = val
            }
          } else {
            consumption[normalizedOverrideName] = val
          }
        } else {
          delete consumption[normalizedOverrideName]
        }
      }
    })
  }

  return consumption
}

export const getAggregatedConsumption = async (items = []) => {
  const portions = await Portion.find({})
  const portionMap = Object.fromEntries(portions.map(p => [p.name, p]))
  const inventoryItems = await Inventory.find({})
  const inventoryMap = Object.fromEntries(inventoryItems.map(i => [i.name, i]))

  const aggregated = {}
  items.forEach((item) => {
    const consumption = getConsumptionForItem(item, portionMap, inventoryMap)
    Object.entries(consumption).forEach(([name, qty]) => {
      aggregated[name] = round((aggregated[name] || 0) + qty)
    })
  })
  return aggregated
}

export const validateInventoryAvailability = async (items = []) => {
  const aggregated = await getAggregatedConsumption(items)
  const names = Object.keys(aggregated).map(normalizeName)
  const inventoryItems = await Inventory.find({ name: { $in: names } })

  const currentByName = new Map(inventoryItems.map((item) => [item.name, item]))
  const shortages = []

  Object.entries(aggregated).forEach(([name, required]) => {
    const current = currentByName.get(normalizeName(name))
    if (!current) {
      shortages.push({ ingredient: name, required, available: 0, reason: 'Producto no registrado en inventario' })
      return
    }
    if (current.isActive === false) {
      shortages.push({ ingredient: name, required, available: 0, reason: 'Producto desactivado' })
      return
    }
    if (current.stock < required) {
      shortages.push({ ingredient: name, required, available: current.stock, reason: 'Stock insuficiente' })
    }
  })

  return { ok: shortages.length === 0, shortages, consumption: aggregated }
}

export const discountInventoryForOrder = async (items = [], orderId, actor) => {
  const { ok, shortages, consumption } = await validateInventoryAvailability(items)
  if (!ok) {
    const error = new Error('Inventory shortage detected')
    error.statusCode = 409
    error.details = shortages
    throw error
  }

  const logs = []

  await Promise.all(
    Object.entries(consumption).map(async ([name, qty]) => {
      const previousItem = await Inventory.findOneAndUpdate(
        { name: normalizeName(name) },
        { $inc: { stock: -qty } },
        { new: false }
      )

      if (previousItem) {
        logs.push({
          ingredient: previousItem._id,
          ingredientName: previousItem.name,
          type: 'OUT',
          amount: qty,
          previousStock: previousItem.stock,
          newStock: round(previousItem.stock - qty),
          orderId,
          userId: actor?._id,
          userName: actor?.name,
          reason: `Venta - Orden ${orderId}`
        })
      }
    })
  )

  if (logs.length > 0) {
    await InventoryLog.insertMany(logs)
  }

  return consumption
}

export const getAvailablePlatesCount = async () => {
  const inventory = await Inventory.find({})
  const portions = await Portion.find({})
  const portionMap = Object.fromEntries(portions.map(p => [p.name, p]))
  
  const getRawStock = (name) => {
    const item = inventory.find(i => i.name === name)
    if (!item) return 0
    if (item.isActive === false) return 0
    return Number(item.stock || 0)
  }

  const getRequiredPortionQty = (name) => {
    const portion = portionMap[name]
    const inv = inventory.find(i => i.name === name)
    if (portion && inv) {
      try {
        return convertAmountToCatalogUnit(portion.usedPerPlate, portion.unit, inv.unit)
      } catch (err) {
        return portion.usedPerPlate
      }
    }
    return PACKAGING_CONSUMPTION[name] || DEFAULT_RECIPE_CONSUMPTION[name] || 1
  }

  const mandatoryNames = [
    'plato rectangular',
    'tenedor',
    'servilleta',
    'totopos',
    'queso',
    'plato de 8 onz',
    'tapadera de 8 onz'
  ]

  let mandatoryLimit = Infinity
  mandatoryNames.forEach((name) => {
    const required = getRequiredPortionQty(name)
    const stock = getRawStock(name)
    const possible = Math.floor(stock / required)
    if (possible < mandatoryLimit) mandatoryLimit = possible
  })

  const rojaStock = getRawStock('salsa roja')
  const verdeStock = getRawStock('salsa verde')
  
  const rojaPortion = getRequiredPortionQty('salsa roja')
  const halfRojaPortion = rojaPortion / 2
  const verdePortion = getRequiredPortionQty('salsa verde')
  const halfVerdePortion = verdePortion / 2

  const getMaxSaucePlatesDynamic = (rStock, vStock) => {
    const roja = Number(rStock || 0)
    const verde = Number(vStock || 0)
    let maxPlates = 0
    const maxDivorciados = Math.min(Math.floor(roja / halfRojaPortion), Math.floor(verde / halfVerdePortion))

    for (let divorciados = 0; divorciados <= maxDivorciados; divorciados += 1) {
      const remainingRoja = roja - divorciados * halfRojaPortion
      const remainingVerde = verde - divorciados * halfVerdePortion
      const total = divorciados + Math.floor(remainingRoja / rojaPortion) + Math.floor(remainingVerde / verdePortion)
      if (total > maxPlates) maxPlates = total
    }

    return maxPlates
  }

  const sauceLimit = getMaxSaucePlatesDynamic(rojaStock, verdeStock)

  const proteinNames = ['steak', 'pollo', 'chorizo']
  const proteinLimit = proteinNames.reduce((sum, name) => sum + Math.floor(getRawStock(name) / getRequiredPortionQty(name)), 0)

  const complementNames = ['aguacate', 'cebolla caramelizada', 'queso extra']
  const complementLimit = complementNames.reduce((sum, name) => sum + Math.floor(getRawStock(name) / getRequiredPortionQty(name)), 0)

  const limits = [mandatoryLimit, sauceLimit, proteinLimit, complementLimit]
  return Math.max(0, Math.min(...limits))
}

export const manualStockAdjustment = async ({
  name,
  amount,
  type,
  price,
  totalPrice,
  portionPrice,
  inputAmount,
  inputUnit,
  storedUnit,
  actor,
  reason
}) => {
  const normalized = normalizeName(name)
  const numericAmount = Number(amount)
  const movementType = type || (numericAmount > 0 ? 'IN' : 'ADJUSTMENT')
  const updateQuery = { $inc: { stock: numericAmount } }

  const hasPortionPrice = portionPrice !== undefined && portionPrice !== null && portionPrice !== '' && !Number.isNaN(Number(portionPrice))
  const normalizedPortionPrice = hasPortionPrice ? round(Number(portionPrice)) : undefined

  if (hasPortionPrice) {
    updateQuery.$set = { lastPrice: normalizedPortionPrice }
  }

  const previousItem = await Inventory.findOneAndUpdate(
    { name: normalized },
    updateQuery,
    { new: false }
  )

  if (!previousItem) {
    throw new Error('Ingredient not found')
  }

  const newStock = round(Number(previousItem.stock || 0) + numericAmount)
  const normalizedTotalPrice = totalPrice !== undefined && totalPrice !== null && totalPrice !== '' && !Number.isNaN(Number(totalPrice))
    ? round(Number(totalPrice))
    : (price !== undefined && price !== null && price !== '' && !Number.isNaN(Number(price)) ? round(Number(price)) : 0)
  const storedAmount = Math.abs(numericAmount)

  await InventoryLog.create({
    ingredient: previousItem._id,
    ingredientName: previousItem.name,
    type: movementType,
    amount: storedAmount,
    price: normalizedTotalPrice,
    inputAmount: inputAmount !== undefined && inputAmount !== null && inputAmount !== '' ? Number(inputAmount) : null,
    inputUnit: inputUnit || null,
    storedAmount,
    storedUnit: storedUnit || previousItem.unit || null,
    totalPrice: normalizedTotalPrice || null,
    portionPrice: hasPortionPrice ? normalizedPortionPrice : null,
    unitPrice: storedAmount > 0 && normalizedTotalPrice > 0 ? round(normalizedTotalPrice / storedAmount) : null,
    previousStock: previousItem.stock,
    newStock,
    userId: actor?._id,
    userName: actor?.name,
    reason: reason || 'Ajuste manual'
  })

  // Synchronize dynamic portion price if Portion entry exists
  if (hasPortionPrice) {
    await Portion.findOneAndUpdate(
      { name: normalized },
      { $set: { price: normalizedPortionPrice } }
    )
  }

  return { ...previousItem.toObject(), stock: newStock, lastPrice: hasPortionPrice ? normalizedPortionPrice : previousItem.lastPrice }
}

export const toggleInventoryItem = async (id, isActive) => {
  const item = await Inventory.findByIdAndUpdate(id, { isActive }, { new: true })
  if (!item) throw new Error('Item not found')
  return item
}

export const seedPortions = async () => {
  for (const item of INVENTORY_CATALOG) {
    const normalizedName = normalizeName(item.name)
    const existing = await Portion.findOne({ name: normalizedName })
    
    if (!existing) {
      const invItem = await Inventory.findOne({ name: normalizedName })
      const price = invItem?.lastPrice || 0
      
      await Portion.create({
        name: normalizedName,
        usedPerPlate: item.usedPerPlate || 1,
        unit: item.unit,
        price
      })
      console.log(`Portion seeded: ${normalizedName} (${item.usedPerPlate} ${item.unit}, price: Q${price})`)
    }
  }
}

export const seedInventory = async () => {
  for (const ingredient of INVENTORY_CATALOG) {
    const normalizedName = normalizeName(ingredient.name)
    const existing = await Inventory.findOne({ name: normalizedName })
    
    if (!existing) {
      await Inventory.create({
        name: normalizedName,
        unit: ingredient.unit,
        category: ingredient.category || 'Otros',
        stock: 0,
        minimumStock: 5,
        isActive: true
      })
      console.log(`Inventory seeded: ${normalizedName} (0 ${ingredient.unit})`)
    } else {
      let shouldSave = false

      if (!existing.category) {
        existing.category = ingredient.category || 'Otros'
        shouldSave = true
      }

      if (ingredient.category === 'Empaque' && existing.isActive === false) {
        existing.isActive = true
        shouldSave = true
      }

      if (shouldSave) {
        await existing.save()
      }
    }
  }

  // Seed Portion sizes/prices
  await seedPortions()
}
