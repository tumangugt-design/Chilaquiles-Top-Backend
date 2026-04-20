export const USER_ROLES = {
  CLIENT: 'CLIENT',
  ADMIN: 'ADMIN',
  REPARTIDOR: 'REPARTIDOR',
  CHEF: 'CHEF'
};

export const USER_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

export const ORDER_STATUS = {
  RECIBIDO: 'recibido',
  EN_PROCESO: 'en_proceso',
  LISTO_PARA_DESPACHO: 'listo_para_despacho',
  EN_CAMINO: 'en_camino',
  ENTREGADO: 'entregado'
};

export const ORDER_STATUS_FLOW = {
  [ORDER_STATUS.RECIBIDO]: [ORDER_STATUS.EN_PROCESO],
  [ORDER_STATUS.EN_PROCESO]: [ORDER_STATUS.LISTO_PARA_DESPACHO],
  [ORDER_STATUS.LISTO_PARA_DESPACHO]: [ORDER_STATUS.EN_CAMINO],
  [ORDER_STATUS.EN_CAMINO]: [ORDER_STATUS.ENTREGADO],
  [ORDER_STATUS.ENTREGADO]: []
};

export const CHEF_ALLOWED_TRANSITIONS = {
  [ORDER_STATUS.RECIBIDO]: [ORDER_STATUS.EN_PROCESO],
  [ORDER_STATUS.EN_PROCESO]: [ORDER_STATUS.LISTO_PARA_DESPACHO]
};

export const DELIVERY_ALLOWED_TRANSITIONS = {
  [ORDER_STATUS.LISTO_PARA_DESPACHO]: [ORDER_STATUS.EN_CAMINO],
  [ORDER_STATUS.EN_CAMINO]: [ORDER_STATUS.ENTREGADO]
};

export const ORDER_PRICING = {
  1: 50,
  2: 90,
  3: 120
};

export const DEFAULT_RECIPE_CONSUMPTION = {
  'salsa roja': 0.1,
  'salsa verde': 0.1,
  'carne': 0.2,
  'pollo': 0.2,
  'chorizo': 0.2,
  'aguacate': 0.1,
  'cebolla caramelizada': 0.08,
  'queso extra': 0.08,
  'cebolla': 0.03,
  'cilantro': 0.01,
  'crema': 0.04,
  'totopos': 0.25
};
