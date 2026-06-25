
import Order from './order.model.js';
import Setting from '../settings/settings.model.js';
import { buildMapsLink, calculateOrderTotal, normalizePhone } from '../helpers/order.helper.js';
import { ORDER_STATUS, USER_ROLES, CHEF_ALLOWED_TRANSITIONS, DELIVERY_ALLOWED_TRANSITIONS } from '../helpers/constants.js';
import { discountInventoryForOrder, validateInventoryAvailability } from '../inventory/inventory.service.js';
import { publishOrderRealtimeEvent } from '../realtime/realtime.service.js';
import { getGuatemalaOrderDatePrefix, getGuatemalaParts } from '../helpers/timezone.helper.js';
import { notifyAdminNewOrder } from '../helpers/email.helper.js';
import { sendOrderReceivedMessage, sendOrderEnRouteMessage, sendOrderDeliveredMessage } from '../bot/whatsapp.service.js';
import { createPaymentLink } from '../finances/paggo.service.js';


const normalizeSelection = (value = '') => String(value || '').trim().toUpperCase().replace(/\s+/g, '_');

const normalizeComplementSelection = (value = '') => {
  const normalized = normalizeSelection(value);
  if (normalized === 'CEBOLLA_CARAMELIZADA') return 'CEBOLLA_CARAMELIZADA';
  if (normalized === 'QUESO_EXTRA') return 'QUESO_EXTRA';
  if (normalized === 'AGUACATE') return 'AGUACATE';
  return normalized;
};

const normalizePromoConstraint = (promo = {}, field) => {
  const raw = promo?.constraints?.[field] ?? promo?.[field] ?? 'ALL';
  if (field === 'complement') return normalizeComplementSelection(raw) || 'ALL';
  return normalizeSelection(raw) || 'ALL';
};

const promoConstraintAllows = (promo = {}, field, value) => {
  const constraint = normalizePromoConstraint(promo, field);
  if (!constraint || constraint === 'ALL') return true;

  const normalizedValue = field === 'complement'
    ? normalizeComplementSelection(value)
    : normalizeSelection(value);

  return constraint === normalizedValue;
};

const throwPromoError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  throw error;
};


const cloneOrderItem = (item = {}) => ({
  sauce: item.sauce,
  protein: item.protein,
  complement: item.complement,
  baseRecipe: {
    onion: item.baseRecipe?.onion !== false,
    cilantro: item.baseRecipe?.cilantro !== false,
    cream: item.baseRecipe?.cream !== false,
  },
  packagingOverrides: item.packagingOverrides || null
});

const completePromoItems = (items = [], requestedCount = 1) => {
  const normalizedItems = items.map(cloneOrderItem);
  const targetCount = Number(requestedCount || 1);

  if (normalizedItems.length === 0 || !targetCount || Number.isNaN(targetCount)) {
    return normalizedItems;
  }

  if (normalizedItems.length > targetCount) {
    throwPromoError(`La promoción permite exactamente ${targetCount} plato(s).`);
  }

  const lastItem = normalizedItems[normalizedItems.length - 1];
  while (normalizedItems.length < targetCount) {
    normalizedItems.push(cloneOrderItem(lastItem));
  }

  return normalizedItems;
};

const getTodayGuatemalaString = () => getGuatemalaParts().dateString;

const resolveAppliedPromotion = async ({ requestedPromo, items }) => {
  if (!requestedPromo?.id) return null;

  const promosSetting = await Setting.findOne({ key: 'promotions' });
  const promotions = Array.isArray(promosSetting?.value) ? promosSetting.value : [];
  const promo = promotions.find((item) => String(item.id) === String(requestedPromo.id));

  if (!promo) throwPromoError('La promoción seleccionada ya no existe.');
  if (!promo.isActive) throwPromoError('La promoción seleccionada no está activa.');

  const today = getTodayGuatemalaString();
  if (promo.startDate && today < promo.startDate) throwPromoError('La promoción todavía no está disponible.');
  if (promo.endDate && today > promo.endDate) throwPromoError('La promoción ya finalizó.');

  const requestedCount = Number(promo.requestedCount || promo.platesCount || promo.quantity || 2);
  const promoPrice = Number(promo.promoPrice ?? promo.price ?? 0);

  if (!requestedCount || Number.isNaN(requestedCount) || requestedCount < 1) {
    throwPromoError('La promoción no tiene una cantidad válida de platos.');
  }

  if (!promoPrice || Number.isNaN(promoPrice) || promoPrice <= 0) {
    throwPromoError('La promoción no tiene un precio válido.');
  }

  let promoPlates = [];
  if (Array.isArray(promo.plates) && promo.plates.length > 0) {
    promoPlates = promo.plates.map(cloneOrderItem);
  } else {
    // Legacy fallback using single config and constraints
    if (items.length > requestedCount) {
      throwPromoError(`La promoción permite exactamente ${requestedCount} plato(s).`);
    }

    promoPlates = completePromoItems(items, requestedCount);
    promoPlates.forEach((item, index) => {
      const plateNumber = index + 1;
      if (!promoConstraintAllows(promo, 'sauce', item.sauce)) {
        throwPromoError(`El plato ${plateNumber} no cumple con la salsa permitida por la promoción.`);
      }
      if (!promoConstraintAllows(promo, 'protein', item.protein)) {
        throwPromoError(`El plato ${plateNumber} no cumple con la proteína permitida por la promoción.`);
      }
      if (!promoConstraintAllows(promo, 'complement', item.complement)) {
        throwPromoError(`El plato ${plateNumber} no cumple con el complemento permitido por la promoción.`);
      }
    });
  }

  return {
    id: promo.id,
    name: promo.name || 'Promoción',
    promoPrice,
    requestedCount,
    plates: promoPlates,
    constraints: {
      sauce: normalizePromoConstraint(promo, 'sauce'),
      protein: normalizePromoConstraint(promo, 'protein'),
      complement: normalizePromoConstraint(promo, 'complement'),
    }
  };
};

const buildNavigationLinks = (location) => {
  if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
    return { googleMaps: null, waze: null };
  }
  const googleMaps = buildMapsLink(location);
  const waze = `https://waze.com/ul?ll=${location.lat},${location.lng}&navigate=yes`;
  return { googleMaps, waze };
};

const generateOrderNumber = async () => {
  const datePrefix = getGuatemalaOrderDatePrefix();

  const lastOrder = await Order.findOne({
    orderNumber: { $regex: `^${datePrefix}\\d+$` }
  }).sort({ orderNumber: -1 });

  let nextSequence = 1;

  if (lastOrder?.orderNumber) {
    const lastSequence = Number(String(lastOrder.orderNumber).slice(4));
    if (!Number.isNaN(lastSequence)) {
      nextSequence = lastSequence + 1;
    }
  }

  return `${datePrefix}${String(nextSequence).padStart(2, '0')}`;
};


const baseHistoryQuery = () => Order.find()
  .populate('userId', 'name phone email address photoUrl role status')
  .populate('chefId', 'name phone email photoUrl role status')
  .populate('repartidorId', 'name phone email photoUrl role status');

export const createOrderRecord = async ({ user, customer, items, sauceTemperature, appliedPromo, appliedPromos, couponCode, paymentMethod = 'efectivo' }) => {
  let orderItems = Array.isArray(items) ? items.map(cloneOrderItem) : [];

  const reqPromos = Array.isArray(appliedPromos) && appliedPromos.length > 0 
    ? appliedPromos 
    : (appliedPromo?.id ? [appliedPromo] : []);

  const resolvedPromos = [];
  let totalPromoPrice = 0;
  let promoPlatesCombined = [];

  let itemOffset = 0;
  for (const reqPromo of reqPromos) {
    const resolved = await resolveAppliedPromotion({ 
      requestedPromo: reqPromo, 
      items: orderItems.slice(itemOffset, itemOffset + (reqPromo.requestedCount || 2)) 
    });
    
    if (resolved) {
      resolvedPromos.push(resolved);
      totalPromoPrice += Number(resolved.promoPrice || 0);
      const count = Number(resolved.requestedCount || resolved.plates?.length || 2);

      let promoPlates = [];
      if (resolved.plates && resolved.plates.length > 0) {
        promoPlates = resolved.plates.map((plate, index) => {
          const cloned = cloneOrderItem(plate);
          const clientItem = orderItems[itemOffset + index];
          if (clientItem && clientItem.baseRecipe) {
            cloned.baseRecipe = {
              onion: clientItem.baseRecipe.onion !== false,
              cilantro: clientItem.baseRecipe.cilantro !== false,
              cream: clientItem.baseRecipe.cream !== false,
            };
          }
          return cloned;
        });
      } else {
        const clientPromoItems = orderItems.slice(itemOffset, itemOffset + count);
        promoPlates = completePromoItems(clientPromoItems, count);
      }

      promoPlatesCombined.push(...promoPlates);
      itemOffset += count;
    }
  }

  if (resolvedPromos.length > 0) {
    orderItems = promoPlatesCombined;
  }

  let total = resolvedPromos.length > 0 ? totalPromoPrice : calculateOrderTotal(orderItems.length);
  
  let couponDiscount = 0;
  let cleanCouponCode = null;

  if (couponCode) {
    cleanCouponCode = String(couponCode).trim().toUpperCase();
    const couponsSetting = await Setting.findOne({ key: 'coupons' });
    const coupons = Array.isArray(couponsSetting?.value) ? couponsSetting.value : [];
    const coupon = coupons.find(c => c.code === cleanCouponCode);
    
    if (coupon) {
      if (!coupon.isActive) {
        throwPromoError('El cupón seleccionado no está activo.');
      }
      if (coupon.usedCount >= coupon.maxUses) {
        throwPromoError('El cupón ha alcanzado su límite de usos.');
      }
      couponDiscount = Math.round((total * (coupon.discountPercent / 100)) * 100) / 100;
      total = Math.max(0, total - couponDiscount);
      
      // Increment coupon usage
      coupon.usedCount += 1;
      await Setting.findOneAndUpdate(
        { key: 'coupons' },
        { $set: { value: coupons } }
      );
    } else {
      throwPromoError('El cupón ingresado no es válido.');
    }
  }

  const navigationLinks = buildNavigationLinks(customer.location);
  const orderNumber = await generateOrderNumber();

  const availability = await validateInventoryAvailability(orderItems);

  if (!availability.ok) {
    const firstShortage = availability.shortages?.[0];
    const itemName = firstShortage?.ingredient ? String(firstShortage.ingredient).toUpperCase() : 'algún producto';
    const available = Number(firstShortage?.available || 0);
    const required = Number(firstShortage?.required || 0);
    const message = firstShortage
      ? `Stock insuficiente para ${itemName}. Disponible: ${available}. Requerido: ${required}.`
      : 'Stock insuficiente para completar el pedido.';
    const error = new Error(message);
    error.statusCode = 409;
    error.details = availability.shortages;
    throw error;
  }

  let paymentLink = null;
  if (paymentMethod === 'tarjeta') {
    try {
      paymentLink = await createPaymentLink({ amount: total, description: `Pago Orden #${orderNumber}`, orderNumber });
    } catch (e) {
      console.error('[createOrderRecord] Failed to create payment link', e);
      const err = new Error('No se pudo generar el link de pago con Paggo. Por favor intenta con efectivo o más tarde.');
      err.statusCode = 502;
      throw err;
    }
  }

  let order = null;

  try {
    order = await Order.create({
      userId: user._id,
      orderNumber,
      name: customer.name,
      phone: normalizePhone(customer.phone || user.phone),
      address: customer.address,
      accessCode: customer.accessCode || '',
      location: customer.location,
      navigationLinks,
      items: orderItems,
      sauceTemperature: sauceTemperature === 'FRIO' ? 'FRIO' : 'CALIENTE',
      appliedPromo: resolvedPromos[0] || null,
      appliedPromos: resolvedPromos,
      couponCode: cleanCouponCode,
      couponDiscount,
      total,
      paymentMethod,
      paymentLink,
      status: ORDER_STATUS.RECIBIDO
    });

    await discountInventoryForOrder(orderItems, order._id, user);
    await publishOrderRealtimeEvent(order);
    notifyAdminNewOrder(order).catch((emailError) => {
      console.error('No se pudo enviar correo de nuevo pedido:', emailError.message);
    });

    if (order.phone) {
      const summary = generateOrderSummary(order.items);
      const result = await sendOrderReceivedMessage(order.phone, {
        customerName: order.name,
        orderNumber: order.orderNumber,
        orderSummary: summary,
        orderTotal: `Q${order.total.toFixed(2)}`,
        paymentMethod: order.paymentMethod,
        paymentLink: order.paymentLink
      });
      order.set('whatsappMessages.orderReceived', { sent: result.sent, sentAt: new Date(), method: result.method, error: result.error, wamid: result.wamid });
      await order.save();
    }

    return order;
  } catch (error) {
    if (order?._id) {
      await Order.findByIdAndDelete(order._id);
    }
    throw error;
  }
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
  } else if (user.role === USER_ROLES.ADMIN) {
    if (statusFilter && statusFilter !== 'all') {
      query.status = statusFilter;
    }
    query.hiddenForAdmin = { $ne: true };
  }

  return Order.find(query)
    .populate('chefId', 'name photoUrl')
    .populate('repartidorId', 'name photoUrl')
    .sort({ updatedAt: -1 });
};

export const getOrderHistoryForAdmin = async ({ type, userId }) => {
  if (!userId) {
    return [];
  }

  const query = {};

  if (type === 'client') {
    query.userId = userId;
  } else if (type === 'chef') {
    query.chefId = userId;
  } else if (type === 'repartidor') {
    query.repartidorId = userId;
    query.status = ORDER_STATUS.ENTREGADO;
  } else {
    return [];
  }

  return baseHistoryQuery().find(query).sort({ createdAt: -1 });
};

export const validateStatusTransition = ({ currentStatus, nextStatus, role }) => {
  if (role === USER_ROLES.ADMIN) return true;

  const matrix = role === USER_ROLES.CHEF ? CHEF_ALLOWED_TRANSITIONS : DELIVERY_ALLOWED_TRANSITIONS;
  return Array.isArray(matrix[currentStatus]) && matrix[currentStatus].includes(nextStatus);
};

export const updateOrderStatusRecord = async ({ orderId, nextStatus, actor }) => {
  const order = await Order.findById(orderId);
  if (!order) return null;

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
  
  if (nextStatus === ORDER_STATUS.EN_CAMINO && order.phone && !order.whatsappMessages?.orderOnTheWay?.sent) {
    const summary = generateOrderSummary(order.items);
    const result = await sendOrderEnRouteMessage(order.phone, {
      orderNumber: order.orderNumber,
      orderSummary: summary
    });
    order.set('whatsappMessages.orderOnTheWay', { sent: result.sent, sentAt: new Date(), method: result.method, error: result.error, wamid: result.wamid });
  } else if (nextStatus === ORDER_STATUS.ENTREGADO) {
    if (order.phone && !order.whatsappMessages?.orderDelivered?.sent) {
      const summary = generateOrderSummary(order.items);
      const result = await sendOrderDeliveredMessage(order.phone, {
        orderNumber: order.orderNumber,
        orderSummary: summary
      });
      order.set('whatsappMessages.orderDelivered', { sent: result.sent, sentAt: new Date(), method: result.method, error: result.error, wamid: result.wamid });
    }
    order.deliveredAt = new Date();
    order.surveyStatus = 'PENDING';
    order.surveySendAt = new Date(Date.now() + 35 * 60000); // 35 minutes delay
  }

  await order.save();
  await publishOrderRealtimeEvent(order);
  return order;
};

export const checkOperatingHoursRecord = async () => {
  return await isOperatingNow();
};

export const generateOrderSummary = (items) => {
  return items.map((item, i) => {
    let base = `${i + 1}. Chilaquiles (${item.sauce}, ${item.protein}, ${item.complement})`;
    let without = [];
    if (item.baseRecipe) {
      if (item.baseRecipe.onion === false) without.push('Cebolla');
      if (item.baseRecipe.cilantro === false) without.push('Cilantro');
      if (item.baseRecipe.cream === false) without.push('Crema');
    }
    if (without.length > 0) base += ` [Sin: ${without.join(', ')}]`;
    return base;
  }).join('\n');
};

export const hideDeliveredOrdersRecord = async () => {
  return Order.updateMany(
    { status: ORDER_STATUS.ENTREGADO, hiddenForAdmin: { $ne: true } },
    { $set: { hiddenForAdmin: true } }
  );
};
