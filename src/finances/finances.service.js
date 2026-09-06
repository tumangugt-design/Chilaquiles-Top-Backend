import Order from '../orders/order.model.js'
import InventoryLog from '../inventory/inventoryLog.model.js'
import Purchase from '../purchases/purchase.model.js'
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
const calculateISR = (rentaBrutaMensual, cfg) => {
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
  const orders = await Order.find({ createdAt: { $gte: start, $lt: end }, status: { $ne: 'cancelado' } }).select('total paymentMethod')
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

// Valor de inventario en bodega a costo real, usando los lotes de Compras
// vigentes (remainingQuantity > 0). Solo cubre ingredientes que entraron por
// Compras - lo que sigue entrando por Entradas manuales no tiene lote y no
// se puede valuar a costo real (se omite, no se estima).
const getInventoryValuation = async () => {
  const rows = await Purchase.aggregate([
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
    },
    { $sort: { valorTotal: -1 } }
  ])

  const items = rows.map((r) => ({
    ingredientName: r._id,
    unit: r.unit,
    remainingQuantity: round2(r.remainingQuantity),
    valorTotal: round2(r.valorTotal)
  }))

  return {
    valorTotal: round2(items.reduce((s, i) => s + i.valorTotal, 0)),
    items
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
