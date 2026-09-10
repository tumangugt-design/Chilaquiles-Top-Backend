import Order from '../orders/order.model.js'
import InventoryLog from '../inventory/inventoryLog.model.js'
import Purchase from '../purchases/purchase.model.js'
import PurchaseAllocation from '../purchases/purchase-allocation.model.js'
import { toDisplayLabel, ORDER_STATUS } from '../helpers/constants.js'
import Supplier from '../suppliers/supplier.model.js'
import Setting from '../settings/settings.model.js'
import { getGuatemalaDayRange, getGuatemalaMonthRange, getGuatemalaWeekRange, GUATEMALA_TIMEZONE } from '../helpers/timezone.helper.js'

// --- Configuracion fiscal y de pagos (Fase Finanzas) ---
// Valores reales confirmados por Denilson:
//  - RTU (SAT): IVA Regimen General 12% (diferencia creditos/debitos, mensual);
//    ISR Regimen Opcional Simplificado sobre Ingresos de Actividades Lucrativas
//    (5% hasta Q30,000 de renta bruta mensual, 7% sobre el excedente).
//  - Cuenta real de Recurrente (verificada en transacciones reales de Chilaquiles Top):
//    comision = Q2.00 fijo + 4.5% del monto: retiene ademas 15% del IVA debito de
//    cada venta con tarjeta (agente de retencion) y cobra Q0.25 por emitir la
//    factura electronica (FEL) automatica de cada pago con tarjeta.
// Se guarda en Setting (key: 'taxConfig') para poder ajustarla sin redeploy si
// la SAT o Recurrente cambian las tarifas - nunca se vuelve a inventar un valor,
// se actualiza aqui con el dato real y ya.
const DEFAULT_TAX_CONFIG = {
  ivaRate: 0.12,
  isrTier1Limit: 30000,
  isrTier1Rate: 0.05,
  isrTier2Rate: 0.07,
  recurrenteFeeFixed: 2,
  recurrenteFeeRate: 0.045,
  recurrenteIvaRetentionRate: 0.15,
  recurrenteInvoiceFee: 0.25,
  pricesIncludeIva: true
}

export const getTaxConfig = async () => {
  const doc = await Setting.findOne({ key: 'taxConfig' })
  return { ...DEFAULT_TAX_CONFIG, ...(doc?.value || {}) }
}

export const updateTaxConfig = async (partialConfig) => {
  const current = await getTaxConfig()
  const numericKeys = ['ivaRate', 'isrTier1Limit', 'isrTier1Rate', 'isrTier2Rate', 'recurrenteFeeFixed', 'recurrenteFeeRate', 'recurrenteIvaRetentionRate', 'recurrenteInvoiceFee']
  const next = { ...current }
  numericKeys.forEach((key) => {
    if (partialConfig[key] !== undefined && partialConfig[key] !== null && partialConfig[key] !== '') {
      const n = Number(partialConfig[key])
      if (!Number.isNaN(n) && n >= 0) next[key] = n
    }
  })
  if (typeof partialConfig.pricesIncludeIva === 'boolean') next.pricesIncludeIva = partialConfig.pricesIncludeIva

  const updated = await Setting.findOneAndUpdate(
    { key: 'taxConfig' },
    { $set: { value: next } },
    { new: true, upsert: true }
  )
  return updated.value
}

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100

// Regimen Opcional Simplificado sobre Ingresos de Actividades Lucrativas:
// definitivo mensual sobre renta bruta (sin deducciones), tramo unico por mes.
export const calculateISR = (rentaBrutaMensual, cfg) => {
  const base = Math.max(0, rentaBrutaMensual)
  if (base <= cfg.isrTier1Limit) return base * cfg.isrTier1Rate
  return cfg.isrTier1Limit * cfg.isrTier1Rate + (base - cfg.isrTier1Limit) * cfg.isrTier2Rate
}

// Desglose fiscal para un conjunto de ordenes ya cargado (evita reconsultar).
// includeIsr solo debe ser true cuando `orders` representa EXACTAMENTE un mes
// calendario (el tramo de Q30,000 es mensual) - para dia/semana se omite y el
// front lo remite a "Este Mes".
const buildFiscalBreakdown = (orders, cfg, { includeIsr }) => {
  const cardOrders = orders.filter((o) => o.paymentMethod === 'tarjeta')
  const cardRevenue = cardOrders.reduce((s, o) => s + (o.total || 0), 0)
  const cashRevenue = orders.filter((o) => o.paymentMethod !== 'tarjeta').reduce((s, o) => s + (o.total || 0), 0)
  const revenue = cardRevenue + cashRevenue

  // Los precios al consumidor ya incluyen IVA (practica estandar GT) -> se extrae,
  // no se suma encima.
  const ivaFactor = cfg.ivaRate / (1 + cfg.ivaRate)
  const ivaDebito = cfg.pricesIncludeIva ? revenue * ivaFactor : revenue * cfg.ivaRate

  const comisionRecurrente = round2(cardOrders.reduce((s, o) => s + cfg.recurrenteFeeFixed + (o.total || 0) * cfg.recurrenteFeeRate, 0))
  const facturasEmitidasRecurrente = cardOrders.length
  const facturacionFeeRecurrente = round2(facturasEmitidasRecurrente * cfg.recurrenteInvoiceFee)
  const ivaDebitoTarjeta = cfg.pricesIncludeIva ? cardRevenue * ivaFactor : cardRevenue * cfg.ivaRate
  const ivaRetenidoRecurrente = round2(ivaDebitoTarjeta * cfg.recurrenteIvaRetentionRate)

  // IVA neto estimado = debito - retenido por Recurrente. NO descuenta credito
  // fiscal de compras (no se traza todavia que Compras tengan factura valida) -
  // se deja fuera en vez de inventarlo (ver "notas.iva" en el resumen).
  const ivaNetoEstimado = round2(Math.max(0, ivaDebito - ivaRetenidoRecurrente))

  const rentaBrutaMensual = cfg.pricesIncludeIva ? revenue - ivaDebito : revenue
  const isrEstimado = includeIsr ? round2(calculateISR(rentaBrutaMensual, cfg)) : null

  return {
    ventasTarjeta: round2(cardRevenue),
    ventasEfectivo: round2(cashRevenue),
    facturasEmitidasRecurrente,
    comisionRecurrente,
    facturacionFeeRecurrente,
    ivaDebito: round2(ivaDebito),
    ivaRetenidoRecurrente,
    ivaNetoEstimado,
    isrEstimado
  }
}

const summarizeRealCogs = (outLogs) => {
  const total = outLogs.length
  const traced = outLogs.filter((l) => l.totalCost !== null && l.totalCost !== undefined)
  const costoRealTrazado = round2(traced.reduce((s, l) => s + Number(l.totalCost || 0), 0))
  const coberturaTrazabilidadPct = total > 0 ? round2((traced.length / total) * 100) : 0
  return { costoRealTrazado, coberturaTrazabilidadPct, movimientosSalida: total, movimientosConCostoReal: traced.length }
}

const totalCargaFiscalYComisiones = (fiscal) => round2(fiscal.ivaNetoEstimado + (fiscal.isrEstimado || 0) + fiscal.comisionRecurrente + fiscal.facturacionFeeRecurrente)

const getPeriodStats = async (start, end, cfg, { isrMonthly = false } = {}) => {
  // 'cancelado' no existe en ORDER_STATUS, asi que este filtro no filtraba
  // nada: todo pedido con tarjeta abandonado en el checkout se contaba como
  // ingreso, y encima se le cargaba comision de Recurrente, FEL e ISR sobre
  // una venta que nunca ocurrio.
  const orders = await Order.find({ createdAt: { $gte: start, $lt: end }, status: { $ne: ORDER_STATUS.PENDIENTE_PAGO } }).select('total paymentMethod')
  const revenue = orders.reduce((sum, order) => sum + (order.total || 0), 0)

  const logsIn = await InventoryLog.find({ type: 'IN', createdAt: { $gte: start, $lt: end } }).select('price')
  const costs = logsIn.reduce((sum, log) => sum + Number(log.price || 0), 0)

  const logsOut = await InventoryLog.find({ type: 'OUT', createdAt: { $gte: start, $lt: end } }).select('totalCost')
  const realCogs = summarizeRealCogs(logsOut)

  const fiscal = buildFiscalBreakdown(orders, cfg, { includeIsr: isrMonthly })
  const utilidadNetaAjustada = round2(revenue - costs - totalCargaFiscalYComisiones(fiscal))

  return {
    revenue: round2(revenue),
    costs: round2(costs),
    utilities: round2(revenue - costs),
    orderCount: orders.length,
    fiscal,
    realCogs,
    utilidadNetaAjustada
  }
}

const getGuatemalaMonthKey = (date) => {
  const gtDate = new Date(date.getTime() - 6 * 60 * 60 * 1000)
  const yyyy = gtDate.getUTCFullYear()
  const mm = String(gtDate.getUTCMonth() + 1).padStart(2, '0')
  return `${yyyy}-${mm}`
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

// Valor de inventario en bodega a costo real. Se valua en las DOS capas de la
// jerarquia, porque el inventario real vive en ambas y sumarlas no duplica
// nada: cuando la materia prima se transforma, su lote de Compra baja y en su
// lugar nace un lote de Stock con el costo heredado.
//
//   Capa 1 - Materia prima sin transformar: lotes de Compra con existencia.
//   Capa 2 - Stock listo para vender: lotes de Stock con existencia, que son
//            el insumo listo comprado y el producto terminado producido.
//
// Antes solo se valuaba la capa 1, asi que el empaque, el queso, la crema y
// todas las salsas y proteinas ya producidas quedaban fuera del valor de
// bodega.
const getInventoryValuation = async () => {
  const rawRows = await Purchase.aggregate([
    { $match: { remainingQuantity: { $gt: 0 } } },
    {
      $project: {
        ingredientName: 1,
        remainingQuantity: 1,
        unit: 1,
        unitCost: { $cond: [{ $gt: ['$quantity', 0] }, { $divide: ['$totalCost', '$quantity'] }, 0] }
      }
    },
    { $addFields: { remainingValue: { $multiply: ['$remainingQuantity', '$unitCost'] } } },
    {
      $group: {
        _id: '$ingredientName',
        unit: { $first: '$unit' },
        remainingQuantity: { $sum: '$remainingQuantity' },
        valorTotal: { $sum: '$remainingValue' }
      }
    }
  ])

  const stockRows = await PurchaseAllocation.aggregate([
    { $match: { remainingQuantity: { $gt: 0 } } },
    { $addFields: { remainingValue: { $multiply: ['$remainingQuantity', '$costPerProducedUnit'] } } },
    {
      $group: {
        _id: '$stockItemName',
        unit: { $first: '$producedUnit' },
        remainingQuantity: { $sum: '$remainingQuantity' },
        valorTotal: { $sum: '$remainingValue' }
      }
    }
  ])

  const mapRow = (capa) => (r) => ({
    ingredientName: r._id,
    displayLabel: toDisplayLabel(r._id),
    capa,
    unit: r.unit,
    remainingQuantity: round2(r.remainingQuantity),
    valorTotal: round2(r.valorTotal)
  })

  const materiaPrima = rawRows.map(mapRow('materia_prima'))
  const stock = stockRows.map(mapRow('stock'))

  const valorMateriaPrima = round2(materiaPrima.reduce((s, i) => s + i.valorTotal, 0))
  const valorStock = round2(stock.reduce((s, i) => s + i.valorTotal, 0))

  return {
    valorTotal: round2(valorMateriaPrima + valorStock),
    valorMateriaPrima,
    valorStock,
    items: [...materiaPrima, ...stock].sort((a, b) => b.valorTotal - a.valorTotal)
  }
}

// Gasto por proveedor (historico completo de Compras) - responde "de donde
// sale la plata" y sirve para negociar volumen con los proveedores grandes.
const getGastoPorProveedor = async () => {
  const rows = await Purchase.aggregate([
    {
      $group: {
        _id: '$supplier',
        totalGastado: { $sum: '$totalCost' },
        compras: { $sum: 1 },
        ultimaCompra: { $max: '$purchaseDate' }
      }
    },
    { $sort: { totalGastado: -1 } }
  ])

  const supplierIds = rows.filter((r) => r._id).map((r) => r._id)
  const suppliers = await Supplier.find({ _id: { $in: supplierIds } }).select('name')
  const supplierMap = Object.fromEntries(suppliers.map((s) => [String(s._id), s.name]))

  return rows.map((r) => ({
    proveedor: r._id ? (supplierMap[String(r._id)] || 'Proveedor eliminado') : 'Sin proveedor asignado',
    totalGastado: round2(r.totalGastado),
    compras: r.compras,
    ultimaCompra: r.ultimaCompra
  }))
}

export const getFinancialSummary = async () => {
  const now = new Date()
  const dayRange = getGuatemalaDayRange(now)
  const weekRange = getGuatemalaWeekRange(now)
  const monthRange = getGuatemalaMonthRange(now)

  const cfg = await getTaxConfig()

  const [daily, weekly, monthly] = await Promise.all([
    getPeriodStats(dayRange.start, dayRange.end, cfg, { isrMonthly: false }),
    getPeriodStats(weekRange.start, weekRange.end, cfg, { isrMonthly: false }),
    getPeriodStats(monthRange.start, monthRange.end, cfg, { isrMonthly: true })
  ])

  const [globalOrders, globalLogsIn, globalLogsOut, valorInventario, gastoPorProveedor] = await Promise.all([
    Order.find({ status: { $ne: 'cancelado' } }).select('total paymentMethod createdAt'),
    InventoryLog.find({ type: 'IN' }).select('price createdAt'),
    InventoryLog.find({ type: 'OUT' }).select('totalCost createdAt'),
    getInventoryValuation(),
    getGastoPorProveedor()
  ])

  const globalRevenue = globalOrders.reduce((sum, o) => sum + (o.total || 0), 0)
  const globalCosts = globalLogsIn.reduce((sum, l) => sum + Number(l.price || 0), 0)
  const globalFiscal = buildFiscalBreakdown(globalOrders, cfg, { includeIsr: false })
  const globalRealCogs = summarizeRealCogs(globalLogsOut)

  // Agrupar todo por mes calendario (Guatemala) para la tabla de historial y
  // para sumar el ISR global correctamente (es por tramos MENSUALES, no se
  // puede aplicar el tramo de Q30,000 una sola vez sobre la vida entera).
  const ordersByMonth = {}
  globalOrders.forEach((o) => {
    const key = getGuatemalaMonthKey(o.createdAt)
    if (!ordersByMonth[key]) ordersByMonth[key] = []
    ordersByMonth[key].push(o)
  })
  const logsInByMonth = {}
  globalLogsIn.forEach((l) => {
    const key = getGuatemalaMonthKey(l.createdAt)
    if (!logsInByMonth[key]) logsInByMonth[key] = []
    logsInByMonth[key].push(l)
  })
  const logsOutByMonth = {}
  globalLogsOut.forEach((l) => {
    const key = getGuatemalaMonthKey(l.createdAt)
    if (!logsOutByMonth[key]) logsOutByMonth[key] = []
    logsOutByMonth[key].push(l)
  })

  const allMonthKeys = Array.from(new Set([
    ...Object.keys(ordersByMonth),
    ...Object.keys(logsInByMonth),
    ...Object.keys(logsOutByMonth)
  ])).sort().reverse()

  const byMonth = allMonthKeys.map((key) => {
    const [year, monthNum] = key.split('-')
    const label = `${MONTH_NAMES[Number(monthNum) - 1]} ${year}`

    const monthOrders = ordersByMonth[key] || []
    const monthLogsIn = logsInByMonth[key] || []
    const monthLogsOut = logsOutByMonth[key] || []

    const rev = monthOrders.reduce((sum, o) => sum + (o.total || 0), 0)
    const cst = monthLogsIn.reduce((sum, l) => sum + Number(l.price || 0), 0)
    const fiscal = buildFiscalBreakdown(monthOrders, cfg, { includeIsr: true })
    const realCogs = summarizeRealCogs(monthLogsOut)
    const utilidadNetaAjustada = round2(rev - cst - totalCargaFiscalYComisiones(fiscal))

    return {
      month: key,
      label,
      revenue: round2(rev),
      costs: round2(cst),
      utilities: round2(rev - cst),
      orderCount: monthOrders.length,
      fiscal,
      realCogs,
      utilidadNetaAjustada
    }
  })

  // El ISR global es la suma de los ISR mensuales ya calculados por tramos,
  // nunca el tramo aplicado de un solo golpe sobre la vida entera.
  globalFiscal.isrEstimado = round2(byMonth.reduce((s, m) => s + (m.fiscal.isrEstimado || 0), 0))

  const global = {
    revenue: round2(globalRevenue),
    costs: round2(globalCosts),
    utilities: round2(globalRevenue - globalCosts),
    orderCount: globalOrders.length,
    fiscal: globalFiscal,
    realCogs: globalRealCogs,
    utilidadNetaAjustada: round2(globalRevenue - globalCosts - totalCargaFiscalYComisiones(globalFiscal))
  }

  return {
    timezone: GUATEMALA_TIMEZONE,
    taxConfig: cfg,
    daily,
    weekly,
    monthly,
    global,
    byMonth,
    valorInventario,
    gastoPorProveedor,
    notas: {
      iva: 'IVA neto estimado = debito fiscal (12% de las ventas) menos el 15% que Recurrente ya retiene y remite en pagos con tarjeta. No descuenta credito fiscal de compras con factura porque el sistema aun no registra que Compras tienen factura valida.',
      isr: 'ISR bajo Regimen Opcional Simplificado sobre Ingresos de Actividades Lucrativas (RTU vigente): 5% sobre la renta bruta mensual hasta Q30,000, 7% sobre el excedente. Se calcula por mes calendario, nunca sobre acumulados.',
      costoReal: 'El costo real trazado (COGS) solo cubre ingredientes que pasaron por Compras -> Produccion de lotes con FIFO. El resto de salidas de inventario (Entradas manuales antiguas) no tiene costo real asociado todavia; "cobertura" indica que porcentaje de las salidas de cada periodo si lo tiene.',
      comisionRecurrente: 'Comision real verificada en la cuenta de Recurrente de Chilaquiles Top: Q2.00 fijo + 4.5% por transaccion con tarjeta, mas Q0.25 por la factura electronica que Recurrente emite automaticamente en cada pago con tarjeta.'
    }
  }
}

// Rentabilidad REAL por promocion (Fase Costeo por Lotes): junta lo que ya
// existia por separado - Order.appliedPromo(s).id y el costo real trazado
// (InventoryLog OUT con FIFO) de cada orden - para responder "esta promo,
// en la practica, dio la utilidad que se penso al crearla?". No reemplaza
// el margen que se muestra al crear/editar la promocion (ese sigue siendo
// una proyeccion); esto es lo que realmente paso, orden por orden.
export const getPromotionsProfitabilityReport = async () => {
  const orders = await Order.find({
    status: { $ne: 'cancelado' },
    $or: [
      { 'appliedPromo.id': { $ne: null } },
      { 'appliedPromos.0': { $exists: true } }
    ]
  }).select('_id appliedPromo appliedPromos')

  if (orders.length === 0) {
    return { promotions: [], notas: 'Todavia no hay ordenes que hayan usado una promocion.' }
  }

  const orderIds = orders.map((o) => o._id)
  const outLogs = await InventoryLog.find({ type: 'OUT', orderId: { $in: orderIds } }).select('orderId totalCost')

  const realCostByOrder = new Map()
  outLogs.forEach((log) => {
    if (log.totalCost === null || log.totalCost === undefined) return
    const key = String(log.orderId)
    realCostByOrder.set(key, round2((realCostByOrder.get(key) || 0) + Number(log.totalCost || 0)))
  })

  const byPromo = new Map()

  orders.forEach((order) => {
    const promos = Array.isArray(order.appliedPromos) && order.appliedPromos.length > 0
      ? order.appliedPromos
      : (order.appliedPromo?.id ? [order.appliedPromo] : [])

    if (promos.length === 0) return

    const orderRealCost = realCostByOrder.get(String(order._id))
    // Si la orden combina mas de una promo, el costo real de la orden no se
    // puede partir por linea (FIFO descuenta por ingrediente, no por promo) -
    // se reparte por partes iguales entre las promos de esa orden y se marca
    // como "compartida" para que quede claro que es una aproximacion.
    const shareCount = promos.length
    const isShared = shareCount > 1

    promos.forEach((promo) => {
      const key = String(promo.id)
      if (!byPromo.has(key)) {
        byPromo.set(key, {
          promotionId: key,
          name: promo.name || 'Promoción',
          ordersCount: 0,
          ordersWithRealCost: 0,
          ordersShared: 0,
          revenue: 0,
          realCost: 0,
        })
      }
      const entry = byPromo.get(key)
      entry.ordersCount += 1
      entry.revenue += Number(promo.promoPrice || 0)
      if (isShared) entry.ordersShared += 1
      if (orderRealCost !== undefined) {
        entry.ordersWithRealCost += 1
        entry.realCost += orderRealCost / shareCount
      }
    })
  })

  const promotions = Array.from(byPromo.values())
    .map((entry) => {
      const hasRealCost = entry.ordersWithRealCost > 0
      const realProfit = hasRealCost ? entry.revenue - entry.realCost : null
      const realMargin = (realProfit !== null && entry.revenue > 0) ? round2((realProfit / entry.revenue) * 100) : null
      return {
        ...entry,
        revenue: round2(entry.revenue),
        realCost: round2(entry.realCost),
        realProfit: realProfit === null ? null : round2(realProfit),
        realMargin,
        coberturaCostoRealPct: entry.ordersCount > 0 ? round2((entry.ordersWithRealCost / entry.ordersCount) * 100) : 0
      }
    })
    .sort((a, b) => b.ordersCount - a.ordersCount)

  return {
    promotions,
    notas: 'realCost solo cubre ordenes cuyos ingredientes ya pasaron por Compras -> Lotes FIFO (ver coberturaCostoRealPct por promocion). Cuando una orden combino mas de una promocion, su costo real se reparte en partes iguales entre ellas (ver ordersShared).'
  }
}
