import { createOrderRecord, getOrdersByRole, getOrderHistoryForAdmin, updateOrderStatusRecord } from './order.service.js'

export const createOrder = async (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : []
    const customer = req.body.customer

    if (!customer?.name || !customer?.phone || !customer?.address || items.length === 0) {
      return res.status(400).json({ message: 'Nombre, teléfono, dirección e items son obligatorios' })
    }

    const { upsertGuestClientUser } = await import('../users/user.service.js')
    const user = await upsertGuestClientUser({
      phone: customer.phone,
      name: customer.name,
      address: customer.address,
      location: customer.location,
    })

    const order = await createOrderRecord({
      user,
      customer,
      items,
    })

    return res.status(201).json({ message: 'Pedido creado', order })
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || 'No se pudo crear el pedido',
      details: error.details || null,
    })
  }
}

export const getOrders = async (req, res) => {
  try {
    const { status } = req.query
    const orders = await getOrdersByRole(req.user, status)
    return res.status(200).json(orders)
  } catch (error) {
    return res.status(500).json({ message: 'No se pudieron cargar los pedidos', error: error.message })
  }
}

export const getOrderHistory = async (req, res) => {
  try {
    const orders = await getOrderHistoryForAdmin({
      type: req.query.type,
      userId: req.query.userId,
    })

    return res.status(200).json(orders)
  } catch (error) {
    return res.status(500).json({ message: 'No se pudo cargar el historial', error: error.message })
  }
}

export const updateOrderStatus = async (req, res) => {
  try {
    const order = await updateOrderStatusRecord({
      orderId: req.params.orderId,
      nextStatus: req.body.status,
      actor: req.user,
    })

    if (!order) {
      return res.status(404).json({ message: 'Pedido no encontrado' })
    }

    return res.status(200).json({ message: 'Estado actualizado', order })
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message || 'No se pudo actualizar el estado' })
  }
}

export const getOrderWorkflowHelp = async (req, res) => {
  return res.status(200).json({
    flow: ['Pedido', 'Cocina', 'Despacho', 'Entrega'],
  })
}
