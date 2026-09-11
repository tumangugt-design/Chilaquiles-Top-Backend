import Inventory from './inventory.model.js'
import { roundUnitCost } from '../helpers/money.js';
import InventoryLog from './inventoryLog.model.js'
import Portion from './portion.model.js'
import PurchaseAllocation from '../purchases/purchase-allocation.model.js'
import TransformationProcess from './transformation-process.model.js'
import Setting from '../settings/settings.model.js'
import User from '../users/user.model.js'
import {
  DEFAULT_RECIPE_CONSUMPTION,
  PACKAGING_CONSUMPTION,
  INVENTORY_CATALOG,
  INVENTORY_CATALOG_MAP,
  TRANSFORMATION_PROCESS_CATALOG,
  ITEM_TYPES,
  resolveStockName,
  toDisplayLabel,
  LEGACY_STOCK_NAME_MAP
} from '../helpers/constants.js'

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
  kg: 'kg',
  kgs: 'kg',
  kilo: 'kg',
  kilos: 'kg',
  kilogramo: 'kg',
  kilogramos: 'kg',
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
    g: { g: 1, lb: 453.59237, oz: 28.349523125, kg: 1000 },
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

export const getPortionQtyInBaseUnit = (name, portionMap, inventoryMap) => {
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

// Divorciados son DOS salsas, y dos salsas no caben en un envase: van en dos
// de 4 onz, una cada una. Antes esto se leia de la porcion de 'plato de 4 onz'
// en Recetario, que vale 1 porque significa "cuantos lleva un plato", no
// "cuantos lleva divorciados": se descontaba 1 envase donde se usaban 2.
const SAUCE_CUPS_DIVORCIADOS = 2

const getConsumptionForItem = (item, portionMap, inventoryMap, sauceTemperature = 'CALIENTE') => {
  const sauce = normalizeOptionValue(item.sauce)
  const protein = normalizeOptionValue(item.protein)
  const complement = normalizeComplementValue(item.complement)

  const getQty = (name) => getPortionQtyInBaseUnit(name, portionMap, inventoryMap)

  const consumption = {
    totopos: getQty('totopos'),
    queso: getQty('queso'),
  }

  const isFrio = sauceTemperature === 'FRIO'

  if (isFrio) {
    // En frio la salsa siempre va en plato(s)/tapadera(s) de 4 onz (nunca 8 onz).
    // Divorciados usa 2 (1 roja + 1 verde, configurado en Recetario). Salsa unica usa 1.
    // Ademas, TODO pedido frio lleva un plato/tapadera de 4 onz adicional, aparte,
    // exclusivo para la proteina - independiente del tipo de salsa (ajuste Denilson).
    let saucePlates = 1
    if (sauce === 'ROJA') {
      consumption['salsa roja'] = getQty('salsa roja')
    } else if (sauce === 'VERDE') {
      consumption['salsa verde'] = getQty('salsa verde')
    } else if (sauce === 'DIVORCIADOS') {
      consumption['salsa roja'] = round(getQty('salsa roja') / 2)
      consumption['salsa verde'] = round(getQty('salsa verde') / 2)
      saucePlates = SAUCE_CUPS_DIVORCIADOS
    } else if (sauce) {
      const dbSauceName = resolveStockName(sauce.toLowerCase().replace(/_/g, ' '))
      consumption[dbSauceName] = getQty(dbSauceName)
    }
    const proteinPlates = 1
    consumption['plato de 4 onz'] = saucePlates + proteinPlates
    consumption['tapadera de 4 onz'] = saucePlates + proteinPlates
  } else {
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
      consumption['plato de 4 onz'] = SAUCE_CUPS_DIVORCIADOS
      consumption['tapadera de 4 onz'] = SAUCE_CUPS_DIVORCIADOS
    } else if (sauce) {
      const dbSauceName = resolveStockName(sauce.toLowerCase().replace(/_/g, ' '))
      consumption[dbSauceName] = getQty(dbSauceName)
      consumption['plato de 8 onz'] = getQty('plato de 8 onz')
      consumption['tapadera de 8 onz'] = getQty('tapadera de 8 onz')
    }
  }

  // Las opciones del menu conservan su valor historico (CHORIZO, AGUACATE...),
  // pero lo que se descuenta ya es el PRODUCTO TERMINADO, nunca la materia
  // prima: resolveStockName traduce cebolla->cebolla picada, chorizo->chorizo
  // argentino, aguacate->aguacate hass, etc.
  const hardcodedProteins = { STEAK: 'steak', POLLO: 'pollo', CHORIZO: 'chorizo argentino', PULLED_PORK: 'pulled pork' }
  if (protein) {
    if (hardcodedProteins[protein]) {
      consumption[hardcodedProteins[protein]] = getQty(hardcodedProteins[protein])
    } else {
      const dbName = resolveStockName(protein.toLowerCase().replace(/_/g, ' '))
      consumption[dbName] = getQty(dbName)
    }
  }

  const hardcodedComplements = {
    AGUACATE: 'aguacate hass',
    AGUACATE_HASS: 'aguacate hass',
    CEBOLLA_CARAMELIZADA: 'cebolla caramelizada',
    QUESO_EXTRA: 'queso extra'
  }
  if (complement) {
    if (hardcodedComplements[complement]) {
      consumption[hardcodedComplements[complement]] = getQty(hardcodedComplements[complement])
    } else {
      const dbName = resolveStockName(complement.toLowerCase().replace(/_/g, ' '))
      consumption[dbName] = getQty(dbName)
    }
  }

  // La base del plato lleva cebolla y cilantro YA PICADOS (producto terminado),
  // no la materia prima cruda.
  if (item.baseRecipe?.onion) consumption['cebolla picada'] = getQty('cebolla picada')
  if (item.baseRecipe?.cilantro) consumption['cilantro picado'] = getQty('cilantro picado')
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

export const getAggregatedConsumption = async (items = [], sauceTemperature = 'CALIENTE') => {
  const portions = await Portion.find({})
  const portionMap = Object.fromEntries(portions.map(p => [p.name, p]))
  const inventoryItems = await Inventory.find({})
  const inventoryMap = Object.fromEntries(inventoryItems.map(i => [i.name, i]))

  const aggregated = {}
  items.forEach((item) => {
    const consumption = getConsumptionForItem(item, portionMap, inventoryMap, sauceTemperature)
    Object.entries(consumption).forEach(([name, qty]) => {
      aggregated[name] = round((aggregated[name] || 0) + qty)
    })
  })

  // Productos de consumo "por orden" (ej. bolsa de delivery): se agregan una
  // sola vez para toda la orden, sin importar cuántos platos contenga.
  if (items.length > 0) {
    portions
      .filter((p) => p.consumptionType === 'order')
      .forEach((p) => {
        const qty = getPortionQtyInBaseUnit(p.name, portionMap, inventoryMap)
        if (qty > 0) {
          aggregated[p.name] = round((aggregated[p.name] || 0) + qty)
        }
      })
  }

  return aggregated
}

export const validateInventoryAvailability = async (items = [], sauceTemperature = 'CALIENTE') => {
  const aggregated = await getAggregatedConsumption(items, sauceTemperature)
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

// Consume, en orden FIFO (lote mas antiguo primero), la cantidad `requiredQty`
// (ya expresada en la unidad catalogo del producto de Stock, ej. gramos) de
// las PurchaseAllocation disponibles para ese producto. Descuenta
// remainingQuantity de cada lote usado y devuelve de donde salio el costo.
//
// Best-effort: si el producto no tiene lotes registrados (aun no pasa por
// Compras/Lotes) o hay un problema de unidades incompatibles, retorna null y
// el descuento de inventario sigue funcionando igual, simplemente sin dato
// de costo/lote para esa salida (Fase 3 es una capa adicional, no un requisito).
export const consumeFifoBatches = async (ingredientName, requiredQty, inventoryUnit) => {
  if (!requiredQty || requiredQty <= 0) return null

  const stockItemName = normalizeName(ingredientName)
  const allocations = await PurchaseAllocation.find({
    stockItemName,
    remainingQuantity: { $gt: 0 }
  }).sort({ allocationDate: 1 })

  if (allocations.length === 0) return null

  let needed = requiredQty
  const used = []
  const bulkOps = []

  for (const allocation of allocations) {
    if (needed <= 0.0001) break

    let factor
    try {
      factor = convertAmountToCatalogUnit(1, allocation.producedUnit, inventoryUnit)
    } catch (err) {
      // Unidad del lote incompatible con la unidad del producto en Stock:
      // no podemos costear FIFO con este lote, seguimos con el siguiente.
      continue
    }

    const remainingInInventoryUnit = round(allocation.remainingQuantity * factor)
    if (remainingInInventoryUnit <= 0) continue

    const takeInInventoryUnit = Math.min(needed, remainingInInventoryUnit)
    const takeInProducedUnit = round(takeInInventoryUnit / factor)
    if (takeInProducedUnit <= 0) continue

    const cost = round(takeInProducedUnit * allocation.costPerProducedUnit)

    used.push({
      allocation: allocation._id,
      quantityConsumed: takeInProducedUnit,
      unit: allocation.producedUnit,
      costPerUnit: allocation.costPerProducedUnit,
      cost
    })

    const newRemaining = round(allocation.remainingQuantity - takeInProducedUnit)
    const depleted = newRemaining <= 0.001
    // $inc con guarda, no $set con un valor calculado desde una lectura vieja.
    // Dos ventas simultaneas del mismo lote leian 1000, ambas escribian 800, y
    // el lote quedaba en 800 habiendo entregado 400.
    bulkOps.push({
      updateOne: {
        filter: { _id: allocation._id, remainingQuantity: { $gte: takeInProducedUnit } },
        update: depleted
          ? { $set: { remainingQuantity: 0, isDepleted: true } }
          : { $inc: { remainingQuantity: -takeInProducedUnit } }
      }
    })

    needed = round(needed - takeInInventoryUnit)
  }

  if (used.length === 0) return null
  if (bulkOps.length > 0) await PurchaseAllocation.bulkWrite(bulkOps)

  const uncoveredQty = Math.max(round(needed), 0)
  const coveredQty = round(requiredQty - uncoveredQty)
  const totalCost = round(used.reduce((sum, u) => sum + u.cost, 0))

  return {
    sourceAllocations: used,
    totalCost,
    costPerUnit: coveredQty > 0 ? round(totalCost / coveredQty) : null,
    coveredQty,
    uncoveredQty
  }
}

// "Asoma" (sin consumir) el costo del lote FIFO mas antiguo con existencia
// para un producto de Stock. A diferencia de consumeFifoBatches, esto NO
// descuenta remainingQuantity ni escribe nada - es de solo lectura, pensado
// para mostrar "cuanto cuesta ahora mismo lo que se va a vender" (ej. en la
// calculadora de Promociones) sin tocar inventario.
//
// Devuelve null si el producto todavia no tiene lotes registrados (aun no
// paso por Compras/Lotes) - en ese caso el llamador debe usar su propio
// respaldo (ej. Inventory.lastPrice).
export const peekCurrentBatchCost = async (ingredientName, catalogUnit) => {
  const stockItemName = normalizeName(ingredientName)
  const allocation = await PurchaseAllocation.findOne({
    stockItemName,
    remainingQuantity: { $gt: 0 }
  }).sort({ allocationDate: 1 })

  if (!allocation) return null

  try {
    const factor = convertAmountToCatalogUnit(1, allocation.producedUnit, catalogUnit)
    if (!factor) return null

    return {
      // Seis decimales: a tres, un costo de Q0.20/lb sobre un producto en
      // gramos se caia a 0.000 y el insumo quedaba gratis.
      costPerCatalogUnit: roundUnitCost(allocation.costPerProducedUnit / factor),
      allocationId: allocation._id,
      allocationDate: allocation.allocationDate,
      remainingQuantity: allocation.remainingQuantity,
      producedUnit: allocation.producedUnit
    }
  } catch (err) {
    // Unidad del lote incompatible con la unidad catalogo del producto:
    // no se puede expresar el costo vivo en esa unidad, se deja en null.
    return null
  }
}

// Version en lote de peekCurrentBatchCost, para no hacer N consultas
// secuenciales cuando se listan todos los productos de Stock a la vez.
export const peekCurrentBatchCosts = async (items = []) => {
  const results = new Map()
  await Promise.all(
    items.map(async ({ name, unit }) => {
      const peek = await peekCurrentBatchCost(name, unit)
      results.set(normalizeName(name), peek)
    })
  )
  return results
}

export const discountInventoryForOrder = async (items = [], orderId, actor, sauceTemperature = 'CALIENTE') => {
  const { ok, shortages, consumption } = await validateInventoryAvailability(items, sauceTemperature)
  if (!ok) {
    const error = new Error('Inventory shortage detected')
    error.statusCode = 409
    error.details = shortages
    throw error
  }


  const logs = []

  await Promise.all(
    Object.entries(consumption).map(async ([name, qty]) => {
      // Guarda atomica: el filtro exige que la existencia alcance EN EL
      // MOMENTO del descuento. Sin ella, dos pedidos que pasaron la validacion
      // con el mismo stock lo descontaban los dos y el inventario quedaba
      // negativo — el `min: 0` del esquema no protege, porque Mongoose no corre
      // validadores en $inc sin runValidators.
      const previousItem = await Inventory.findOneAndUpdate(
        { name: normalizeName(name), stock: { $gte: qty } },
        { $inc: { stock: -qty } },
        { new: false }
      )

      if (!previousItem) {
        const existente = await Inventory.findOne({ name: normalizeName(name) }).select('stock unit displayLabel name')
        const error = new Error(
          existente
            ? `Se agoto "${existente.displayLabel || existente.name}" mientras se registraba el pedido: quedan ${round(existente.stock)} ${existente.unit} y se necesitan ${qty}.`
            : `El producto "${name}" ya no existe en inventario.`
        )
        error.statusCode = 409
        throw error
      }

      if (previousItem) {
        let fifo = null
        try {
          fifo = await consumeFifoBatches(previousItem.name, qty, previousItem.unit)
        } catch (err) {
          fifo = null
        }

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
          reason: `Venta - Orden ${orderId}`,
          ...(fifo
            ? {
                costPerUnit: fifo.costPerUnit,
                totalCost: fifo.totalCost,
                sourceAllocations: fifo.sourceAllocations.map((u) => ({
                  allocation: u.allocation,
                  quantityConsumed: u.quantityConsumed,
                  unit: u.unit,
                  costPerUnit: u.costPerUnit
                }))
              }
            : {})
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

  // Solo insumo listo y producto terminado pueden sostener un plato: la
  // materia prima (ej. lomo de cerdo crudo) no cuenta como disponibilidad.
  const isSellable = (item) => item.itemType !== ITEM_TYPES.MATERIA_PRIMA
  const proteinNames = inventory
    .filter(item => item.category === 'Proteínas' && isSellable(item))
    .map(item => item.name)
  const proteinLimit = proteinNames.reduce((sum, name) => sum + Math.floor(getRawStock(name) / getRequiredPortionQty(name)), 0)

  const complementNames = inventory
    .filter(item => item.category === 'Complementos' && isSellable(item))
    .map(item => item.name)
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

export const recalculatePortionPrices = async () => {
  try {
    const portions = await Portion.find({})
    for (const portion of portions) {
      const invItem = await Inventory.findOne({ name: portion.name })
      if (!invItem) continue

      let qty = Number(invItem.lastPurchaseQty)
      let unit = invItem.lastPurchaseUnit
      let totalPrice = invItem.lastPurchaseTotalPrice

      const hasDirectPurchaseData = qty > 0 && totalPrice > 0 && unit

      if (!hasDirectPurchaseData) {
        const lastLog = await InventoryLog.findOne({
          ingredientName: portion.name,
          type: 'IN'
        }).sort({ createdAt: -1 })

        if (lastLog) {
          if (lastLog.inputAmount && lastLog.inputUnit) {
            qty = Number(lastLog.inputAmount)
            unit = lastLog.inputUnit
            totalPrice = lastLog.totalPrice ?? lastLog.price
          } else {
            const rawReason = lastLog.reason || ''
            const matchQty = rawReason.match(/Entrada de inventario:\s*([\d.]+)\s*([a-zA-ZáéíóúÁÉÍÓÚñÑ]+)/i)
            const matchTotal = rawReason.match(/Costo Total\s*Q\s*([\d.]+)/i)
            qty = Number(matchQty?.[1] ?? lastLog.amount ?? 0)
            unit = matchQty?.[2] ?? invItem.unit
            totalPrice = matchTotal?.[1] ? Number(matchTotal[1]) : Number(lastLog.totalPrice ?? lastLog.price ?? 0)
          }
        }
      }

      if (qty > 0 && totalPrice > 0 && unit) {
        try {
          const amountInCatalogUnit = convertAmountToCatalogUnit(qty, unit, invItem.unit)
          if (amountInCatalogUnit > 0) {
            let portionInBaseUnit = portion.usedPerPlate
            if (portion.unit !== invItem.unit) {
              try {
                portionInBaseUnit = convertAmountToCatalogUnit(portion.usedPerPlate, portion.unit, invItem.unit)
              } catch (e) {
                portionInBaseUnit = portion.usedPerPlate
              }
            }
            const unitPrice = totalPrice / amountInCatalogUnit
            const portionPrice = Math.round(unitPrice * portionInBaseUnit * 100) / 100
            
            const isWrongLegacyPrice = portion.price === totalPrice && qty > 1
            const isZeroPrice = portion.price === 0

            if (isWrongLegacyPrice || isZeroPrice || portion.price > totalPrice) {
              const prevPrice = portion.price
              portion.price = portionPrice
              await portion.save()
              
              invItem.lastPrice = portionPrice
              await invItem.save()
              
              console.log(`[MIGRATION] Recalculated wrong/legacy price for portion ${portion.name}: was Q${prevPrice}, corrected to Q${portionPrice}`)
            }
          }
        } catch (error) {
          console.error(`Error recalculating portion price for ${portion.name}:`, error.message)
        }
      }
    }
  } catch (err) {
    console.error('Error during recalculatePortionPrices migration:', err.message)
  }
}

// Migracion de una sola vez (v1 de la jerarquia).
//
// Antes el plato descontaba materia prima directamente (cebolla, cilantro,
// chorizo, aguacate). Ahora descuenta el producto terminado equivalente
// (cebolla picada, cilantro picado, chorizo argentino, aguacate hass). Si no
// se traslada la existencia, el dia del despliegue toda orden con esos
// ingredientes se rechazaria por "stock insuficiente" hasta producir un lote.
//
// Por eso se mueve UNA VEZ la existencia (y el costo por porcion) del producto
// viejo al nuevo, dejando rastro en InventoryLog. Denilson puede ajustar
// despues desde Stock lo que fisicamente siga crudo.
export const migrateLegacyStockToFinishedGoods = async () => {
  const FLAG = 'hierarchy_migration_v1'
  const existingFlag = await Setting.findOne({ key: FLAG })
  if (existingFlag?.value?.done) return { skipped: true }

  const moved = []

  // InventoryLog exige userId: se usa el admin del sistema. Si por lo que sea
  // no hay ninguno, el traslado igual se hace y solo se omite el rastro.
  const systemUser = await User.findOne({ role: 'ADMIN' }).select('_id name')

  for (const [legacyName, finishedName] of Object.entries(LEGACY_STOCK_NAME_MAP)) {
    const legacy = await Inventory.findOne({ name: legacyName })
    const finished = await Inventory.findOne({ name: finishedName })
    if (!legacy || !finished) continue

    const legacyStock = Number(legacy.stock || 0)
    const finishedStock = Number(finished.stock || 0)

    // Solo se traslada si el producto terminado todavia esta en cero: si ya
    // tiene existencia propia, la migracion no debe tocarlo.
    if (legacyStock <= 0 || finishedStock > 0) continue

    let amount = legacyStock
    if (legacy.unit !== finished.unit) {
      try {
        amount = convertAmountToCatalogUnit(legacyStock, legacy.unit, finished.unit)
      } catch (err) {
        continue
      }
    }

    await Inventory.updateOne({ _id: legacy._id }, { $set: { stock: 0 } })
    await Inventory.updateOne(
      { _id: finished._id },
      {
        $set: {
          stock: round(amount),
          lastPrice: legacy.lastPrice || finished.lastPrice || 0,
          lastPurchaseQty: legacy.lastPurchaseQty ?? null,
          lastPurchaseUnit: legacy.lastPurchaseUnit ?? null,
          lastPurchaseTotalPrice: legacy.lastPurchaseTotalPrice ?? null
        }
      }
    )

    // El costo por porcion tambien se hereda para no perder el costeo del plato.
    const legacyPortion = await Portion.findOne({ name: legacyName })
    if (legacyPortion?.price) {
      await Portion.findOneAndUpdate({ name: finishedName }, { $set: { price: legacyPortion.price } })
    }

    const reason = `Migración de jerarquía: la existencia de "${toDisplayLabel(legacyName)}" (materia prima) se trasladó a "${toDisplayLabel(finishedName)}" (producto terminado), que es lo que ahora consume el plato.`

    if (systemUser?._id) {
      try {
        await InventoryLog.insertMany([
          {
            ingredient: legacy._id,
            ingredientName: legacy.name,
            type: 'ADJUSTMENT',
            amount: legacyStock,
            previousStock: legacyStock,
            newStock: 0,
            userId: systemUser._id,
            userName: 'Sistema (migración de jerarquía)',
            reason
          },
          {
            ingredient: finished._id,
            ingredientName: finished.name,
            type: 'ADJUSTMENT',
            amount: round(amount),
            previousStock: 0,
            newStock: round(amount),
            userId: systemUser._id,
            userName: 'Sistema (migración de jerarquía)',
            reason
          }
        ])
      } catch (logError) {
        console.error('[MIGRATION v1] No se pudo escribir el rastro en InventoryLog:', logError.message)
      }
    }

    moved.push({ from: legacyName, to: finishedName, amount: round(amount), unit: finished.unit })
    console.log(`[MIGRATION v1] ${legacyName} → ${finishedName}: ${round(amount)} ${finished.unit}`)
  }

  await Setting.findOneAndUpdate(
    { key: FLAG },
    { $set: { value: { done: true, movedAt: new Date(), moved } } },
    { upsert: true }
  )

  return { skipped: false, moved }
}

export const seedTransformationProcesses = async () => {
  const report = { created: [], updated: [] }
  for (const process of TRANSFORMATION_PROCESS_CATALOG) {
    const existing = await TransformationProcess.findOne({ name: process.name })
    if (!existing) {
      await TransformationProcess.create({
        name: process.name,
        displayLabel: process.label,
        description: process.description || '',
        expectedLossPct: process.expectedLossPct || 0,
        isActive: true
      })
      report.created.push(process.name)
      continue
    }
    let changed = false
    if (existing.displayLabel !== process.label) { existing.displayLabel = process.label; changed = true }
    if (!existing.description && process.description) { existing.description = process.description; changed = true }
    if (changed) {
      await existing.save()
      report.updated.push(process.name)
    }
  }
  return report
}

export const seedPortions = async () => {
  for (const item of INVENTORY_CATALOG) {
    // La materia prima no se sirve en plato: no lleva porcion.
    if (item.itemType === ITEM_TYPES.MATERIA_PRIMA) continue
    // Sin usedPerPlate definido no se inventa una porcion: el producto existe
    // en Stock pero no entra al consumo por plato hasta que alguien decida
    // cuanto lleva (ej. Picante).
    if (item.usedPerPlate === undefined || item.usedPerPlate === null) continue

    const normalizedName = normalizeName(item.name)
    const existing = await Portion.findOne({ name: normalizedName })

    if (!existing) {
      const invItem = await Inventory.findOne({ name: normalizedName })
      const price = invItem?.lastPrice || 0

      await Portion.create({
        name: normalizedName,
        usedPerPlate: item.usedPerPlate || 1,
        unit: item.unit,
        price,
        consumptionType: item.consumptionType || 'plate'
      })
      console.log(`Portion seeded: ${normalizedName} (${item.usedPerPlate} ${item.unit}, price: Q${price})`)
    } else if (item.consumptionType && existing.consumptionType !== item.consumptionType) {
      existing.consumptionType = item.consumptionType
      await existing.save()
    }
  }
  // Recalculate and fix any wrong legacy prices in database on start
  await recalculatePortionPrices()
}

// Siembra/normaliza el catalogo maestro. Es IDEMPOTENTE: se puede correr las
// veces que sea. El catalogo (helpers/constants.js) es la fuente de verdad de
// la taxonomia — tipo de item, etiqueta visible, categoria, unidad y proceso —
// para que la jerarquia quede pareja en toda la app y no queden cabos sueltos.
export const seedInventory = async ({ silent = false } = {}) => {
  const report = { created: [], updated: [], unchanged: [], processes: null }

  for (const ingredient of INVENTORY_CATALOG) {
    const normalizedName = normalizeName(ingredient.name)
    const existing = await Inventory.findOne({ name: normalizedName })

    if (!existing) {
      await Inventory.create({
        name: normalizedName,
        unit: ingredient.unit,
        category: ingredient.category || 'Otros',
        itemType: ingredient.itemType,
        displayLabel: ingredient.label,
        processName: ingredient.process || '',
        stock: 0,
        minimumStock: ingredient.itemType === ITEM_TYPES.MATERIA_PRIMA ? 0 : 5,
        isActive: true,
        sourceType: ingredient.itemType === ITEM_TYPES.PRODUCTO_TERMINADO ? 'preparado_interno' : 'comprado'
      })
      report.created.push(normalizedName)
      if (!silent) console.log(`Inventory seeded: ${normalizedName} [${ingredient.itemType}] (0 ${ingredient.unit})`)
      continue
    }

    const changes = []

    if (existing.itemType !== ingredient.itemType) {
      changes.push(`tipo: ${existing.itemType || '—'} → ${ingredient.itemType}`)
      existing.itemType = ingredient.itemType
    }
    if (existing.displayLabel !== ingredient.label) {
      changes.push('etiqueta')
      existing.displayLabel = ingredient.label
    }
    if ((existing.category || '') !== (ingredient.category || 'Otros')) {
      changes.push(`categoría: ${existing.category || '—'} → ${ingredient.category}`)
      existing.category = ingredient.category || 'Otros'
    }
    if ((existing.processName || '') !== (ingredient.process || '')) {
      changes.push('proceso')
      existing.processName = ingredient.process || ''
    }
    // La unidad solo se corrige si el producto todavia no tiene existencia ni
    // historia: cambiarla con stock adentro reescribiria costos ya cerrados.
    if (existing.unit !== ingredient.unit && Number(existing.stock || 0) === 0) {
      changes.push(`unidad: ${existing.unit} → ${ingredient.unit}`)
      existing.unit = ingredient.unit
    }
    // El producto terminado nunca se compra: su origen es preparacion interna.
    const expectedSource = ingredient.itemType === ITEM_TYPES.PRODUCTO_TERMINADO ? 'preparado_interno' : 'comprado'
    if (existing.sourceType !== expectedSource) {
      changes.push(`origen: ${existing.sourceType} → ${expectedSource}`)
      existing.sourceType = expectedSource
    }
    if (ingredient.category === 'Empaque' && existing.isActive === false) {
      changes.push('reactivado')
      existing.isActive = true
    }

    if (changes.length > 0) {
      await existing.save()
      report.updated.push({ name: normalizedName, changes })
      if (!silent) console.log(`Inventory normalized: ${normalizedName} — ${changes.join(', ')}`)
    } else {
      report.unchanged.push(normalizedName)
    }
  }

  // Productos fuera del catalogo base (creados a mano por el admin): se les
  // garantiza tipo y etiqueta para que nunca se muestren en minuscula ni
  // queden sin jerarquia.
  const offCatalog = await Inventory.find({ name: { $nin: INVENTORY_CATALOG.map((i) => i.name) } })
  for (const item of offCatalog) {
    const changes = []
    if (!item.itemType) {
      item.itemType = item.sourceType === 'preparado_interno' ? ITEM_TYPES.PRODUCTO_TERMINADO : ITEM_TYPES.INSUMO_LISTO
      changes.push('tipo asignado')
    }
    if (!item.displayLabel) {
      item.displayLabel = toDisplayLabel(item.name)
      changes.push('etiqueta')
    }
    if (changes.length > 0) {
      await item.save()
      report.updated.push({ name: item.name, changes })
    }
  }

  report.processes = await seedTransformationProcesses()

  // Seed Portion sizes/prices
  await seedPortions()

  // Traslado de existencia de materia prima al producto terminado que ahora
  // consume el plato (solo la primera vez). Nunca debe tumbar el arranque:
  // si falla, el servidor sigue levantando y se reintenta en el próximo boot.
  try {
    report.migration = await migrateLegacyStockToFinishedGoods()
  } catch (migrationError) {
    console.error('[MIGRATION v1] Falló el traslado de existencia:', migrationError.message)
    report.migration = { error: migrationError.message }
  }

  // Porciones huerfanas: una porcion sin producto en Inventory es
  // configuracion muerta (restos de pruebas). Se limpian para que el
  // Recetario no muestre filas que no corresponden a nada.
  const inventoryNames = (await Inventory.find({}, 'name')).map((i) => i.name)
  const orphanPortions = await Portion.deleteMany({ name: { $nin: inventoryNames } })
  report.removedOrphanPortions = orphanPortions?.deletedCount || 0
  if (report.removedOrphanPortions > 0) {
    console.log(`[seed] Porciones huérfanas eliminadas: ${report.removedOrphanPortions}`)
  }

  // La materia prima no se sirve por plato: si arrastraba una porcion de la
  // configuracion anterior, se retira para que no ensucie el Recetario.
  const rawMaterialNames = INVENTORY_CATALOG.filter((i) => i.itemType === ITEM_TYPES.MATERIA_PRIMA).map((i) => i.name)
  const removedPortions = await Portion.deleteMany({ name: { $in: rawMaterialNames } })
  report.removedPortions = removedPortions?.deletedCount || 0

  return report
}
