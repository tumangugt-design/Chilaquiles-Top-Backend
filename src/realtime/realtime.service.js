import { getFirebaseFirestore, getFirebaseRealtimeDb } from '../../configs/firebase.js';

export const publishOrderRealtimeEvent = async (order) => {
  const orderObj = order.toObject ? order.toObject() : order;
  const payload = {
    id: (orderObj._id || order._id).toString(),
    status: orderObj.status,
    total: orderObj.total,
    name: orderObj.name,
    phone: orderObj.phone,
    address: orderObj.address,
    navigationLinks: orderObj.navigationLinks ? JSON.parse(JSON.stringify(orderObj.navigationLinks)) : { googleMaps: null, waze: null },
    updatedAt: new Date().toISOString(),
    createdAt: orderObj.createdAt
  };

  try {
    const firebaseRealtimeDb = getFirebaseRealtimeDb();
    const firebaseFirestore = getFirebaseFirestore();

    if (firebaseRealtimeDb) {
      await firebaseRealtimeDb.ref(`orders/${payload.id}`).set(payload);
    }

    if (firebaseFirestore) {
      await firebaseFirestore.collection('ordersRealtime').doc(payload.id).set(payload, { merge: true });
    }
  } catch (error) {
    console.error('Error publishing realtime event (non-critical):', error.message);
    // We don't rethrow because order creation should succeed even if realtime update fails
  }
};
