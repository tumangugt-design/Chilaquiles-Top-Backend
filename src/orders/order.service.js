import Order from './order.model.js';
import { buildMapsLink, calculateOrderTotal, normalizePhone } from '../helpers/order.helper.js';
import { ORDER_STATUS, USER_ROLES, CHEF_ALLOWED_TRANSITIONS, DELIVERY_ALLOWED_TRANSITIONS } from '../helpers/constants.js';
import { discountInventoryForOrder } from '../inventory/inventory.service.js';
import { publishOrderRealtimeEvent } from '../realtime/realtime.service.js';

const buildNavigationLinks = (location) => {
  if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
    return { googleMaps: null, waze: null };
  }
  const googleMaps = buildMapsLink(location);
  const waze = `https://waze.com/ul?ll=${location.lat},${location.lng}&navigate=yes`;
  return { googleMaps, waze };
};

export const createOrderRecord = async ({ user, customer, items }) => {
  const total = calculateOrderTotal(items.length);
  const navigationLinks = buildNavigationLinks(customer.location);

  const order = await Order.create({
    userId: user._id,
    name: customer.name,
    phone: normalizePhone(customer.phone || user.phone),
    address: customer.address,
    location: customer.location,
    navigationLinks,
    items,
    total,
    status: ORDER_STATUS.RECIBIDO
  });

  await discountInventoryForOrder(items);
  await publishOrderRealtimeEvent(order);
  return order;
};

export const getOrdersByRole = async (user, statusFilter = null) => {
  const query = {};

  if (user.role === USER_ROLES.CLIENT) {
    query.userId = user._id;
  } else if (user.role === USER_ROLES.CHEF) {
    if (statusFilter === 'finished') {
      query.chefId = user._id;
      query.status = { $in: [ORDER_STATUS.LISTO_PARA_DESPACHO, ORDER_STATUS.RECOLECTADO, ORDER_STATUS.EN_CAMINO, ORDER_STATUS.ENTREGADO] };
    } else {
      query.$or = [
        { status: ORDER_STATUS.RECIBIDO, chefId: { $exists: false } },
        { status: ORDER_STATUS.RECIBIDO, chefId: null },
        { chefId: user._id, status: { $in: [ORDER_STATUS.EN_PROCESO, ORDER_STATUS.RECIBIDO] } }
      ];
    }
  } else if (user.role === USER_ROLES.REPARTIDOR) {
    if (statusFilter === 'delivered') {
      query.repartidorId = user._id;
      query.status = ORDER_STATUS.ENTREGADO;
    } else {
      query.$or = [
        { status: ORDER_STATUS.LISTO_PARA_DESPACHO, repartidorId: { $exists: false } },
        { status: ORDER_STATUS.LISTO_PARA_DESPACHO, repartidorId: null },
        { repartidorId: user._id, status: { $in: [ORDER_STATUS.RECOLECTADO, ORDER_STATUS.EN_CAMINO] } }
      ];
    }
  }
 else if (user.role === USER_ROLES.ADMIN) {
    if (statusFilter && statusFilter !== 'all') {
      query.status = statusFilter;
    }
  }

  return Order.find(query)
    .populate('chefId', 'name photoUrl')
    .populate('repartidorId', 'name photoUrl')
    .sort({ updatedAt: -1 });
};

export const validateStatusTransition = ({ currentStatus, nextStatus, role }) => {
  if (role === USER_ROLES.ADMIN) return true;

  const matrix = role === USER_ROLES.CHEF ? CHEF_ALLOWED_TRANSITIONS : DELIVERY_ALLOWED_TRANSITIONS;
  return Array.isArray(matrix[currentStatus]) && matrix[currentStatus].includes(nextStatus);
};

export const updateOrderStatusRecord = async ({ orderId, nextStatus, actor }) => {
  const order = await Order.findById(orderId);
  if (!order) return null;

  // Auto-assignment logic
  if (actor.role === USER_ROLES.CHEF) {
    if (order.chefId && order.chefId.toString() !== actor._id.toString()) {
      const error = new Error('Esta orden ya fue tomada por otro Chef');
      error.statusCode = 409;
      throw error;
    }
    if (!order.chefId) order.chefId = actor._id;
  }

  if (actor.role === USER_ROLES.REPARTIDOR) {
    if (order.repartidorId && order.repartidorId.toString() !== actor._id.toString()) {
      const error = new Error('Esta orden ya fue tomada por otro Repartidor');
      error.statusCode = 409;
      throw error;
    }
    if (!order.repartidorId) order.repartidorId = actor._id;
  }

  const isValidTransition = validateStatusTransition({
    currentStatus: order.status,
    nextStatus,
    role: actor.role
  });

  if (!isValidTransition) {
    const error = new Error('Transición de estado no permitida para este rol');
    error.statusCode = 403;
    throw error;
  }

  order.status = nextStatus;
  await order.save();
  await publishOrderRealtimeEvent(order);
  return order;
};
