import { getFirebaseFirestore, getFirebaseRealtimeDb } from '../../configs/firebase.js';

export const publishOrderRealtimeEvent = async (order) => {
  const payload = {
    id: order._id.toString(),
    status: order.status,
    total: order.total,
    name: order.name,
    phone: order.phone,
    address: order.address,
    navigationLinks: order.navigationLinks,
    updatedAt: new Date().toISOString(),
    createdAt: order.createdAt
  };

  const firebaseRealtimeDb = getFirebaseRealtimeDb();
  const firebaseFirestore = getFirebaseFirestore();

  if (firebaseRealtimeDb) {
    await firebaseRealtimeDb.ref(`orders/${payload.id}`).set(payload);
  }

  if (firebaseFirestore) {
    await firebaseFirestore.collection('ordersRealtime').doc(payload.id).set(payload, { merge: true });
  }
};
