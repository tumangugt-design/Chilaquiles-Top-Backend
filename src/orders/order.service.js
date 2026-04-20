import Order from './order.model.js';
import { buildMapsLink, calculateOrderTotal, normalizePhone } from '../helpers/order.helper.js';
import { ORDER_STATUS, USER_ROLES, CHEF_ALLOWED_TRANSITIONS, DELIVERY_ALLOWED_TRANSITIONS } from '../helpers/constants.js';
import { discountInventoryForOrder } from '../inventory/inventory.service.js';
import { publishOrderRealtimeEvent } from '../realtime/realtime.service.js';

const buildNavigationLinks = (location) => {
  const googleMaps = buildMapsLink(location);
  const waze = location?.lat && location?.lng ? `https://waze.com/ul?ll=${location.lat},${location.lng}&navigate=yes` : null;
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

export const getOrdersByRole = async (user) => {
  const query = {};

  if (user.role === USER_ROLES.CLIENT) query.userId = user._id;
  if (user.role === USER_ROLES.CHEF) query.status = { $in: [ORDER_STATUS.RECIBIDO, ORDER_STATUS.EN_PROCESO, ORDER_STATUS.LISTO_PARA_DESPACHO] };
  if (user.role === USER_ROLES.REPARTIDOR) query.status = { $in: [ORDER_STATUS.LISTO_PARA_DESPACHO, ORDER_STATUS.EN_CAMINO] };

  return Order.find(query).sort({ createdAt: -1 });
};

export const validateStatusTransition = ({ currentStatus, nextStatus, role }) => {
  if (role === USER_ROLES.ADMIN) return true;

  const matrix = role === USER_ROLES.CHEF ? CHEF_ALLOWED_TRANSITIONS : DELIVERY_ALLOWED_TRANSITIONS;
  return Array.isArray(matrix[currentStatus]) && matrix[currentStatus].includes(nextStatus);
};

export const updateOrderStatusRecord = async ({ orderId, nextStatus, actor }) => {
  const order = await Order.findById(orderId);
  if (!order) return null;

  const isValidTransition = validateStatusTransition({
    currentStatus: order.status,
    nextStatus,
    role: actor.role
  });

  if (!isValidTransition) {
    const error = new Error('Invalid status transition for this role');
    error.statusCode = 403;
    throw error;
  }

  order.status = nextStatus;
  await order.save();
  await publishOrderRealtimeEvent(order);
  return order;
};
