import { createOrderRecord, getOrdersByRole, getOrderHistoryForAdmin, updateOrderStatusRecord, hideDeliveredOrdersRecord } from './order.service.js'
import { isOperatingNow } from '../settings/settings.service.js'
import { USER_ROLES } from '../helpers/constants.js'


const ZONA_6_VILLA_NUEVA_BOUNDS = {
  // Cobertura real de Zona 6 de Villa Nueva con margen para imprecisión de GPS móvil.
  minLat: 14.50000,
  maxLat: 14.56500,
  minLng: -90.62000,
  maxLng: -90.53500,
}

const ZONA_6_VILLA_NUEVA_CENTER = { lat: 14.53280, lng: -90.58420 }
const ZONA_6_VILLA_NUEVA_RADIUS_KM = 5.2

const getDistanceKm = (pointA, pointB) => {
  const earthRadiusKm = 6371
  const toRad = (value) => (value * Math.PI) / 180
  const dLat = toRad(pointB.lat - pointA.lat)
  const dLng = toRad(pointB.lng - pointA.lng)
  const lat1 = toRad(pointA.lat)
  const lat2 = toRad(pointB.lat)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const isInsideZona6VillaNueva = (location) => {
  const lat = Number(location?.lat)
  const lng = Number(location?.lng)

  if (Number.isNaN(lat) || Number.isNaN(lng)) return false

  const insideBounds =
    lat >= ZONA_6_VILLA_NUEVA_BOUNDS.minLat &&
    lat <= ZONA_6_VILLA_NUEVA_BOUNDS.maxLat &&
    lng >= ZONA_6_VILLA_NUEVA_BOUNDS.minLng &&
    lng <= ZONA_6_VILLA_NUEVA_BOUNDS.maxLng

  const insideRadius =
    getDistanceKm({ lat, lng }, ZONA_6_VILLA_NUEVA_CENTER) <= ZONA_6_VILLA_NUEVA_RADIUS_KM

  return insideBounds && insideRadius
}

export const createOrder = async (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : []
    const customer = req.body.customer

    if (!customer?.name || !customer?.phone || !customer?.address || items.length === 0) {
      return res.status(400).json({ message: 'Nombre, teléfono, dirección e items son obligatorios' })
    }

    // El OTP se valida antes de llegar a este punto en el flujo público.
    // En administración se crea el pedido interno con sesión ADMIN y sin OTP.
    if (req.user?.role !== USER_ROLES.ADMIN) {
      const openNow = await isOperatingNow()
      if (!openNow?.isCurrentlyOpen) {
        return res.status(403).json({ message: 'Estamos cerrados por el momento. Vuelve más tarde.' })
      }

      if (!isInsideZona6VillaNueva(customer.location)) {
        return res.status(403).json({ message: 'Cobertura fuera de rango. Solo atendemos Zona 6 de Villa Nueva.' })
      }
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

export const clearDeliveredOrders = async (req, res) => {
  try {
    const result = await hideDeliveredOrdersRecord()
    return res.status(200).json({ message: 'Pedidos entregados archivados de la vista', result })
  } catch (error) {
    return res.status(500).json({ message: 'No se pudieron limpiar los pedidos', error: error.message })
  }
}
