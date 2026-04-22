import Inventory from './inventory.model.js'
import InventoryLog from './inventoryLog.model.js'
import { DEFAULT_RECIPE_CONSUMPTION, PACKAGING_CONSUMPTION, INVENTORY_CATALOG } from '../helpers/constants.js'

const round = (value) => Math.round(value * 1000) / 1000
const normalizeName = (value = '') => value.trim().toLowerCase()

const getConsumptionForItem = (item) => {
  const consumption = {
    totopos: DEFAULT_RECIPE_CONSUMPTION['totopos'],
    queso: DEFAULT_RECIPE_CONSUMPTION['queso'],
  }

  if (item.sauce === 'ROJA') {
    consumption['salsa roja'] = DEFAULT_RECIPE_CONSUMPTION['salsa roja']
  } else if (item.sauce === 'VERDE') {
    consumption['salsa verde'] = DEFAULT_RECIPE_CONSUMPTION['salsa verde']
  } else if (item.sauce === 'DIVORCIADOS') {
    consumption['salsa roja'] = DEFAULT_RECIPE_CONSUMPTION['salsa roja'] / 2
    consumption['salsa verde'] = DEFAULT_RECIPE_CONSUMPTION['salsa verde'] / 2
  }

  if (item.protein === 'STEAK') consumption['steak'] = DEFAULT_RECIPE_CONSUMPTION['steak']
  if (item.protein === 'POLLO') consumption['pollo'] = DEFAULT_RECIPE_CONSUMPTION['pollo']
  if (item.protein === 'CHORIZO') consumption['chorizo'] = DEFAULT_RECIPE_CONSUMPTION['chorizo']

  if (item.complement === 'AGUACATE') consumption['aguacate'] = DEFAULT_RECIPE_CONSUMPTION['aguacate']
  if (item.complement === 'CEBOLLA_CARAMELIZADA') consumption['cebolla caramelizada'] = DEFAULT_RECIPE_CONSUMPTION['cebolla caramelizada']
  if (item.complement === 'QUESO_EXTRA') consumption['queso extra'] = DEFAULT_RECIPE_CONSUMPTION['queso extra']

  if (item.baseRecipe?.onion) consumption['cebolla'] = DEFAULT_RECIPE_CONSUMPTION['cebolla']
  if (item.baseRecipe?.cilantro) consumption['cilantro'] = DEFAULT_RECIPE_CONSUMPTION['cilantro']
  if (item.baseRecipe?.cream) consumption['crema'] = DEFAULT_RECIPE_CONSUMPTION['crema']

  Object.entries(PACKAGING_CONSUMPTION).forEach(([name, qty]) => {
    consumption[name] = qty
  })

  return consumption
}

export const getAggregatedConsumption = (items = []) => {
  const aggregated = {}
  items.forEach((item) => {
    const consumption = getConsumptionForItem(item)
    Object.entries(consumption).forEach(([name, qty]) => {
      aggregated[name] = round((aggregated[name] || 0) + qty)
    })
  })
  return aggregated
}

export const validateInventoryAvailability = async (items = []) => {
  const aggregated = getAggregatedConsumption(items)
  const names = Object.keys(aggregated).map(normalizeName)
  const inventoryItems = await Inventory.find({ name: { $in: names } })

  const currentByName = new Map(inventoryItems.map((item) => [item.name, item]))
  const shortages = []

  Object.entries(aggregated).forEach(([name, required]) => {
    const current = currentByName.get(normalizeName(name))
    if (!current) {
      shortages.push({ ingredient: name, required, available: 0, reason: 'Ingredient not registered in inventory' })
      return
    }
    if (current.stock < required) {
      shortages.push({ ingredient: name, required, available: current.stock, reason: 'Insufficient stock' })
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

const getMaxSaucePlates = (rojaStock, verdeStock) => {
  const roja = Number(rojaStock || 0)
  const verde = Number(verdeStock || 0)
  let maxPlates = 0
  const maxDivorciados = Math.min(Math.floor(roja / 118), Math.floor(verde / 118))

  for (let divorciados = 0; divorciados <= maxDivorciados; divorciados += 1) {
    const remainingRoja = roja - divorciados * 118
    const remainingVerde = verde - divorciados * 118
    const total = divorciados + Math.floor(remainingRoja / 236) + Math.floor(remainingVerde / 236)
    if (total > maxPlates) maxPlates = total
  }

  return maxPlates
}

export const getAvailablePlatesCount = async () => {
  const inventory = await Inventory.find({})
  const stockMap = new Map(inventory.map((item) => [item.name, Number(item.stock || 0)]))

  const mandatoryNames = [
    'plato rectangular',
    'tenedor',
    'servilleta',
    'sticker',
    'totopos',
    'queso'
  ]

  let mandatoryLimit = Infinity
  mandatoryNames.forEach((name) => {
    const required = PACKAGING_CONSUMPTION[name] || DEFAULT_RECIPE_CONSUMPTION[name]
    const stock = stockMap.get(name) || 0
    const possible = Math.floor(stock / required)
    if (possible < mandatoryLimit) mandatoryLimit = possible
  })

  const sauceLimit = getMaxSaucePlates(stockMap.get('salsa roja'), stockMap.get('salsa verde'))

  const proteinNames = ['steak', 'pollo', 'chorizo']
  const proteinLimit = proteinNames.reduce((sum, name) => sum + Math.floor((stockMap.get(name) || 0) / DEFAULT_RECIPE_CONSUMPTION[name]), 0)

  const complementNames = ['aguacate', 'cebolla caramelizada', 'queso extra']
  const complementLimit = complementNames.reduce((sum, name) => sum + Math.floor((stockMap.get(name) || 0) / DEFAULT_RECIPE_CONSUMPTION[name]), 0)

  const limits = [mandatoryLimit, sauceLimit, proteinLimit, complementLimit].filter((value) => Number.isFinite(value))
  if (limits.length === 0) return 0
  return Math.max(0, Math.min(...limits))
}

export const manualStockAdjustment = async ({ name, amount, type, actor, reason }) => {
  const normalized = normalizeName(name)
  const previousItem = await Inventory.findOneAndUpdate(
    { name: normalized },
    { $inc: { stock: amount } },
    { new: false }
  )

  if (!previousItem) {
    throw new Error('Ingredient not found')
  }

  const newStock = round(previousItem.stock + amount)

  await InventoryLog.create({
    ingredient: previousItem._id,
    ingredientName: previousItem.name,
    type: type || (amount > 0 ? 'IN' : 'ADJUSTMENT'),
    amount: Math.abs(amount),
    previousStock: previousItem.stock,
    newStock,
    userId: actor?._id,
    userName: actor?.name,
    reason: reason || 'Ajuste manual'
  })

  return { ...previousItem.toObject(), stock: newStock }
}

export const seedInventory = async () => {
  for (const ingredient of INVENTORY_CATALOG) {
    const existing = await Inventory.findOne({ name: ingredient.name })
    if (!existing) {
      await Inventory.create({
        name: ingredient.name,
        unit: ingredient.unit,
        stock: 1000,
        minimumStock: 5
      })
      console.log(`Inventory seeded: ${ingredient.name} (1000 ${ingredient.unit})`)
    } else if (existing.stock < 10) {
      existing.stock = 1000
      existing.unit = ingredient.unit
      await existing.save()
      console.log(`Inventory replenished: ${ingredient.name} (Reset to 1000 ${ingredient.unit})`)
    }
  }
}
