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

export const getFinancialSummary = async () => {
  const now = new Date()
  const dayRange = getGuatemalaDayRange(now)
  const weekRange = getGuatemalaWeekRange(now)
  const monthRange = getGuatemalaMonthRange(now)

  const [daily, weekly, monthly] = await Promise.all([
    getPeriodStats(dayRange.start, dayRange.end),
    getPeriodStats(weekRange.start, weekRange.end),
    getPeriodStats(monthRange.start, monthRange.end)
  ])

  return {
    timezone: GUATEMALA_TIMEZONE,
    daily,
    weekly,
    monthly
  }
}
