import { ORDER_PRICING } from './constants.js';

export const normalizePhone = (phone = '') => {
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('502') ? `+${digits}` : `+502${digits}`;
};

export const calculateOrderTotal = (ordersCount = 0) => {
  if (!ordersCount) return 0;
  const groupsOfThree = Math.floor(ordersCount / 3);
  const remainder = ordersCount % 3;
  return (groupsOfThree * ORDER_PRICING[3]) + (remainder ? ORDER_PRICING[remainder] : 0);
};

export const buildMapsLink = (location) => {
  if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') return null;
  const { lat, lng } = location;
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
};
