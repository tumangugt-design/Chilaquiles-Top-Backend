export const USER_ROLES = {
  CLIENT: 'CLIENT',
  ADMIN: 'ADMIN',
  REPARTIDOR: 'REPARTIDOR',
  CHEF: 'CHEF'
}

export const USER_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
}

export const ORDER_STATUS = {
  RECIBIDO: 'recibido',
  EN_PROCESO: 'en_proceso',
  LISTO_PARA_DESPACHO: 'listo_para_despacho',
  RECOLECTADO: 'recolectado',
  EN_CAMINO: 'en_camino',
  ENTREGADO: 'entregado'
}

export const ORDER_STATUS_FLOW = {
  [ORDER_STATUS.RECIBIDO]: [ORDER_STATUS.EN_PROCESO],
  [ORDER_STATUS.EN_PROCESO]: [ORDER_STATUS.LISTO_PARA_DESPACHO],
  [ORDER_STATUS.LISTO_PARA_DESPACHO]: [ORDER_STATUS.RECOLECTADO],
  [ORDER_STATUS.RECOLECTADO]: [ORDER_STATUS.EN_CAMINO],
  [ORDER_STATUS.EN_CAMINO]: [ORDER_STATUS.ENTREGADO],
  [ORDER_STATUS.ENTREGADO]: []
}

export const CHEF_ALLOWED_TRANSITIONS = {
  [ORDER_STATUS.RECIBIDO]: [ORDER_STATUS.EN_PROCESO],
  [ORDER_STATUS.EN_PROCESO]: [ORDER_STATUS.LISTO_PARA_DESPACHO]
}

export const DELIVERY_ALLOWED_TRANSITIONS = {
  [ORDER_STATUS.LISTO_PARA_DESPACHO]: [ORDER_STATUS.RECOLECTADO],
  [ORDER_STATUS.RECOLECTADO]: [ORDER_STATUS.EN_CAMINO],
  [ORDER_STATUS.EN_CAMINO]: [ORDER_STATUS.ENTREGADO]
}

export const ORDER_PRICING = {
  1: 50,
  2: 90,
  3: 120
}

export const DEFAULT_RECIPE_CONSUMPTION = {
  'totopos': 80,
  'queso': 60,
  'crema': 25,
  'cebolla': 15,
  'cilantro': 10,
  'salsa roja': 236,
  'salsa verde': 236,
  'steak': 60,
  'pollo': 60,
  'chorizo': 60,
  'aguacate': 0.5,
  'cebolla caramelizada': 20,
  'queso extra': 30,
}

export const PACKAGING_CONSUMPTION = {
  'plato rectangular': 1,
  'tenedor': 1,
  'servilleta': 2,
  'sticker': 1
}

export const INVENTORY_CATALOG = [
  { name: 'plato rectangular', label: 'Plato rectangular 32 oz con tapa', unit: 'und', category: 'Empaque', usedPerPlate: 1 },
  { name: 'tenedor', label: 'Tenedor', unit: 'und', category: 'Empaque', usedPerPlate: 1 },
  { name: 'servilleta', label: 'Servilleta', unit: 'und', category: 'Empaque', usedPerPlate: 2 },
  { name: 'sticker', label: 'Sticker', unit: 'und', category: 'Empaque', usedPerPlate: 1 },
  { name: 'totopos', label: 'Totopos', unit: 'g', category: 'Base', usedPerPlate: 80 },
  { name: 'queso', label: 'Queso', unit: 'g', category: 'Base', usedPerPlate: 60 },
  { name: 'crema', label: 'Crema', unit: 'ml', category: 'Base', usedPerPlate: 25 },
  { name: 'cebolla', label: 'Cebolla', unit: 'g', category: 'Base', usedPerPlate: 15 },
  { name: 'cilantro', label: 'Cilantro', unit: 'g', category: 'Base', usedPerPlate: 10 },
  { name: 'salsa roja', label: 'Salsa Roja', unit: 'ml', category: 'Salsas', usedPerPlate: 236 },
  { name: 'salsa verde', label: 'Salsa Verde', unit: 'ml', category: 'Salsas', usedPerPlate: 236 },
  { name: 'steak', label: 'Steak', unit: 'g', category: 'Proteínas', usedPerPlate: 60 },
  { name: 'pollo', label: 'Pollo', unit: 'g', category: 'Proteínas', usedPerPlate: 60 },
  { name: 'chorizo', label: 'Chorizo', unit: 'g', category: 'Proteínas', usedPerPlate: 60 },
  { name: 'aguacate', label: 'Aguacate', unit: 'und', category: 'Complementos', usedPerPlate: 0.5 },
  { name: 'cebolla caramelizada', label: 'Cebolla caramelizada', unit: 'g', category: 'Complementos', usedPerPlate: 20 },
  { name: 'queso extra', label: 'Queso extra', unit: 'g', category: 'Complementos', usedPerPlate: 30 },
  { name: 'plato para salsa', label: 'Plato para salsa', unit: 'und', category: 'Empaque', usedPerPlate: 1 },
  { name: 'tapadera para salsa', label: 'Tapadera para salsa', unit: 'und', category: 'Empaque', usedPerPlate: 1 }
]

export const INVENTORY_CATALOG_MAP = Object.fromEntries(INVENTORY_CATALOG.map((item) => [item.name, item]))
export const ALLOWED_INVENTORY_NAMES = INVENTORY_CATALOG.map((item) => item.name)
