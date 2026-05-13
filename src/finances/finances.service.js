import Order from '../orders/order.model.js'
import InventoryLog from '../inventory/inventoryLog.model.js'

const getPeriodStats = async (start, end) => {
  // Revenue: Sum of all orders in period
  const orders = await Order.find({
    createdAt: { $gte: start, $lte: end },
    status: { $ne: 'cancelado' }
  })
  const revenue = orders.reduce((sum, order) => sum + (order.total || 0), 0)

  // Costs: Sum of inventory logs with type 'IN' in period
  const logs = await InventoryLog.find({
    type: 'IN',
    createdAt: { $gte: start, $lte: end }
  })
  const costs = logs.reduce((sum, log) => sum + ((log.price || 0) * (log.amount || 0)), 0)

  return {
    revenue,
    costs,
    utilities: revenue - costs,
    orderCount: orders.length
  }
}

export const getFinancialSummary = async () => {
  const now = new Date()
  
  // Daily
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  
  // Weekly (Monday to Sunday)
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const startOfWeek = new Date(now.setDate(diff))
  startOfWeek.setHours(0, 0, 0, 0)
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(endOfWeek.getDate() + 6)
  endOfWeek.setHours(23, 59, 59, 999)
  
  // Monthly
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

  const [daily, weekly, monthly] = await Promise.all([
    getPeriodStats(startOfDay, endOfDay),
    getPeriodStats(startOfWeek, endOfWeek),
    getPeriodStats(startOfMonth, endOfMonth)
  ])

  return {
    daily,
    weekly,
    monthly
  }
}
