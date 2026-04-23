
import { createOrderRecord, getOrdersByRole, getOrderHistoryForAdmin, updateOrderStatusRecord } from './order.service.js';
import { USER_ROLES } from '../helpers/constants.js';

export const createOrder = async (req, res) => {
  try {

    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const customer = req.body.customer;

    if (!req.user && req.cognitoUser) {
      const { upsertCognitoClientUser } = await import('../users/user.service.js');
      req.user = await upsertCognitoClientUser({
        providerUid: req.cognitoUser.sub,
        phone: req.cognitoUser.phone || customer?.phone,
        email: req.cognitoUser.email,
        name: customer?.name,
        address: customer?.address,
        location: customer?.location,
      });
    }

    if (!req.user) {
      return res.status(403).json({ message: 'Client user must exist in MongoDB before placing an order' });
    }

    if (!customer?.name || !customer?.phone || !customer?.address || items.length === 0) {
      return res.status(400).json({ message: 'Customer data and at least one item are required' });
    }

    const order = await createOrderRecord({
      user: req.user,
      customer,
      items
    });

    return res.status(201).json({ message: 'Order created successfully', order });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || 'Error creating order',
      details: error.details || null
    });
  }
};

export const getOrders = async (req, res) => {
  try {
    const { status } = req.query;
    const orders = await getOrdersByRole(req.user, status);
    return res.status(200).json(orders);
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching orders', error: error.message });
  }
};

export const getOrderHistory = async (req, res) => {
  try {
    const orders = await getOrderHistoryForAdmin({
      type: req.query.type,
      userId: req.query.userId
    });

    return res.status(200).json(orders);
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching order history', error: error.message });
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const order = await updateOrderStatusRecord({
      orderId: req.params.orderId,
      nextStatus: req.body.status,
      actor: req.user
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    return res.status(200).json({ message: 'Order status updated successfully', order });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message || 'Error updating order status' });
  }
};

export const getOrderWorkflowHelp = async (req, res) => {
  return res.status(200).json({
    flow: [
      'Cliente Cognito (teléfono + contraseña + SMS) -> /api/auth/client/sync',
      'Crear pedido -> /api/orders',
      'Chef ve y actualiza: recibido -> en_proceso -> listo_para_despacho',
      'Repartidor ve y actualiza: listo_para_despacho -> recolectado -> en_camino -> entregado'
    ],
    roles: Object.values(USER_ROLES)
  });
};
