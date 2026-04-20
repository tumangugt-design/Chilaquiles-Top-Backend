const Order = require('../models/Order');
const { db } = require('../config/firebase');
const inventoryService = require('./inventory.service');

const createOrder = async (userId, orderData) => {
  const order = new Order({
    userId,
    name: orderData.customer.name,
    phone: orderData.customer.phone,
    address: orderData.customer.address,
    items: orderData.items,
    total: calculateTotal(orderData.items.length),
    status: 'recibido'
  });
  
  await order.save();
  
  // Deduct inventory
  await inventoryService.deductForOrder(order);

  // Emit to Firebase Realtime Database
  await db.ref(`orders/${order._id}`).set(order.toObject());
  
  return order;
};

const updateOrderStatus = async (orderId, status) => {
  const order = await Order.findByIdAndUpdate(orderId, { status }, { new: true });
  if (order) {
    await db.ref(`orders/${order._id}`).update({ status });
  }
  return order;
};

const getOrders = async () => {
  return await Order.find().sort({ createdAt: -1 });
};

const calculateTotal = (platesCount) => {
  if (platesCount === 0) return 0;
  const groupsOfThree = Math.floor(platesCount / 3);
  const remainder = platesCount % 3;
  let total = groupsOfThree * 120;
  if (remainder === 1) total += 50;
  if (remainder === 2) total += 90;
  return total;
};

module.exports = { createOrder, updateOrderStatus, getOrders };
