import Order from '../orders/order.model.js'
import InventoryLog from '../inventory/inventoryLog.model.js'
import { getGuatemalaDayRange, getGuatemalaMonthRange, getGuatemalaWeekRange, GUATEMALA_TIMEZONE } from '../helpers/timezone.helper.js'

const getPeriodStats = async (start, end) => {
  // Revenue: Sum of all orders in period
  const orders = await Order.find({
    createdAt: { $gte: start, $lt: end },
    status: { $ne: 'cancelado' }
  })
  const revenue = orders.reduce((sum, order) => sum + (order.total || 0), 0)

  // Costs: sum fixed entry prices registered in inventory inputs.
  const logs = await InventoryLog.find({
    type: 'IN',
    createdAt: { $gte: start, $lt: end }
  })
  const costs = logs.reduce((sum, log) => sum + Number(log.price || 0), 0)

  return {
    revenue,
    costs,
    utilities: revenue - costs,
    orderCount: orders.length
  }
}

const getGuatemalaMonthKey = (date) => {
  const gtDate = new Date(date.getTime() - 6 * 60 * 60 * 1000)
  const yyyy = gtDate.getUTCFullYear()
  const mm = String(gtDate.getUTCMonth() + 1).padStart(2, '0')
  return `${yyyy}-${mm}`
}

export const getFinancialSummary = async () => {
  const now = new Date()
  const dayRange = getGuatemalaDayRange(now)
  const weekRange = getGuatemalaWeekRange(now)
  const monthRange = getGuatemalaMonthRange(now)

  // Fetch current period stats
  const [daily, weekly, monthly] = await Promise.all([
    getPeriodStats(dayRange.start, dayRange.end),
    getPeriodStats(weekRange.start, weekRange.end),
    getPeriodStats(monthRange.start, monthRange.end)
  ])

  // Fetch all orders and logs for global and month-by-month analysis
  const globalOrders = await Order.find({ status: { $ne: 'cancelado' } })
  const globalLogs = await InventoryLog.find({ type: 'IN' })

  const globalRevenue = globalOrders.reduce((sum, order) => sum + (order.total || 0), 0)
  const globalCosts = globalLogs.reduce((sum, log) => sum + Number(log.price || 0), 0)

  const global = {
    revenue: globalRevenue,
    costs: globalCosts,
    utilities: globalRevenue - globalCosts,
    orderCount: globalOrders.length
  }

  // Group all-time data by month key (Guatemala Time)
  const ordersByMonth = {}
  globalOrders.forEach(order => {
    const key = getGuatemalaMonthKey(order.createdAt)
    if (!ordersByMonth[key]) ordersByMonth[key] = []
    ordersByMonth[key].push(order)
  })

  const logsByMonth = {}
  globalLogs.forEach(log => {
    const key = getGuatemalaMonthKey(log.createdAt)
    if (!logsByMonth[key]) logsByMonth[key] = []
    logsByMonth[key].push(log)
  })

  const allMonthKeys = Array.from(new Set([
    ...Object.keys(ordersByMonth),
    ...Object.keys(logsByMonth)
  ])).sort().reverse() // Newest months first

  const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]

  const byMonth = allMonthKeys.map(key => {
    const [year, monthNum] = key.split('-')
    const label = `${MONTH_NAMES[Number(monthNum) - 1]} ${year}`

    const monthOrders = ordersByMonth[key] || []
    const monthLogs = logsByMonth[key] || []

    const rev = monthOrders.reduce((sum, o) => sum + (o.total || 0), 0)
    const cst = monthLogs.reduce((sum, l) => sum + Number(l.price || 0), 0)

    return {
      month: key,
      label,
      revenue: rev,
      costs: cst,
      utilities: rev - cst,
      orderCount: monthOrders.length
    }
  })

  return {
    timezone: GUATEMALA_TIMEZONE,
    daily,
    weekly,
    monthly,
    global,
    byMonth
  }
}
