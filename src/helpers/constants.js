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
  PENDIENTE_PAGO: 'pendiente_pago',
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

// Reparto apalancado: no hay flota propia. Se le paga una tarifa fija por pedido
// entregado a motoristas que ya trabajan en plataformas de delivery. La tarifa se
// configura en Ajustes y se CONGELA en el pedido al momento de asignarlo, para que
// un cambio de tarifa no reescriba lo que ya se debe.
export const DEFAULT_DELIVERY_FEE = 30
export const DELIVERY_CONFIG_KEY = 'delivery_config'

export const DELIVERY_PAYOUT_STATUS = {
  PENDIENTE: 'PENDIENTE',
  PAGADO: 'PAGADO'
}

export const SAUCE_FULL_PORTION_ML = 200
export const SAUCE_HALF_PORTION_ML = 100

// ---------------------------------------------------------------------------
// JERARQUIA DE INVENTARIO (regla de negocio, Denilson)
//
//   MATERIA_PRIMA      Se compra en bruto. NUNCA sale directo a venta ni entra
//                      a un plato o promocion. Para llegar al plato tiene que
//                      pasar por un proceso de transformacion (que es donde se
//                      registra la merma) y/o una receta.
//
//   INSUMO_LISTO       Se compra ya listo para usarse (empaque, queso, crema,
//                      totopos, aguacate hass). No requiere transformacion:
//                      la compra acredita stock directo y ya puede usarse en
//                      platos y promociones.
//
//   PRODUCTO_TERMINADO Lo cocinamos/picamos/pelamos/partimos nosotros. NO se
//                      puede comprar: solo nace de un lote de produccion con
//                      proceso seleccionado y/o receta. Si entra a platos y
//                      promociones.
//
// Regla derivada: una promocion solo puede construirse con INSUMO_LISTO y
// PRODUCTO_TERMINADO. Nunca con MATERIA_PRIMA.
// ---------------------------------------------------------------------------
export const ITEM_TYPES = {
  MATERIA_PRIMA: 'MATERIA_PRIMA',
  INSUMO_LISTO: 'INSUMO_LISTO',
  PRODUCTO_TERMINADO: 'PRODUCTO_TERMINADO'
}

export const ITEM_TYPE_VALUES = Object.values(ITEM_TYPES)

export const ITEM_TYPE_LABELS = {
  [ITEM_TYPES.MATERIA_PRIMA]: 'Materia Prima',
  [ITEM_TYPES.INSUMO_LISTO]: 'Insumo Listo',
  [ITEM_TYPES.PRODUCTO_TERMINADO]: 'Producto Terminado'
}

// Lo unico que puede aparecer en Compras.
export const PURCHASABLE_ITEM_TYPES = [ITEM_TYPES.MATERIA_PRIMA, ITEM_TYPES.INSUMO_LISTO]
// Lo unico que puede entrar a un plato, promocion o venta.
export const SELLABLE_ITEM_TYPES = [ITEM_TYPES.INSUMO_LISTO, ITEM_TYPES.PRODUCTO_TERMINADO]
// Lo unico que puede entrar como insumo de un lote de produccion.
export const TRANSFORMABLE_INPUT_TYPES = [ITEM_TYPES.MATERIA_PRIMA, ITEM_TYPES.INSUMO_LISTO]

// Procesos de transformacion base. TODO producto terminado tiene proceso
// asignado aunque no tenga receta (ej. cilantro no se mezcla con nada, pero
// si se pica — y ese picado es donde se mide la merma).
export const TRANSFORMATION_PROCESS_CATALOG = [
  { name: 'picado', label: 'Picado', description: 'Se corta en trozos. La merma es el descarte del corte.' },
  { name: 'pelado', label: 'Pelado', description: 'Se retira cascara o piel. La merma es la cascara.' },
  { name: 'desvenado', label: 'Desvenado', description: 'Se retiran venas y semillas (chiles).' },
  { name: 'partido', label: 'Partido', description: 'Se parte o porciona sin picar fino.' },
  { name: 'licuado', label: 'Licuado', description: 'Se licua/procesa una mezcla hasta unificarla.' },
  { name: 'cocido', label: 'Cocido', description: 'Coccion en agua o vapor.' },
  { name: 'asado', label: 'Asado', description: 'Coccion directa a la plancha o parrilla.' },
  { name: 'caramelizado', label: 'Caramelizado', description: 'Coccion lenta hasta caramelizar.' },
  { name: 'deshebrado', label: 'Deshebrado', description: 'Se cocina y se deshebra la proteina.' },
  { name: 'marinado', label: 'Marinado', description: 'Reposo en marinada antes de cocinar.' },
  { name: 'tostado', label: 'Tostado', description: 'Tostado en seco (chiles, semillas).' },
  { name: 'porcionado', label: 'Porcionado', description: 'Se divide en porciones de venta.' }
]

export const TRANSFORMATION_PROCESS_MAP = Object.fromEntries(
  TRANSFORMATION_PROCESS_CATALOG.map((p) => [p.name, p])
)

// ---------------------------------------------------------------------------
// CATALOGO MAESTRO
//
// `name` es la LLAVE INTERNA (siempre minuscula) que une Compras, Stock,
// Porciones, Recetas, Lotes y ordenes historicas. NUNCA se muestra al usuario.
// `label` es lo que se renderiza en toda la app (Title Case).
// ---------------------------------------------------------------------------
export const INVENTORY_CATALOG = [
  // ----------------------------- MATERIA PRIMA -----------------------------
  { name: 'miltomate', label: 'Miltomate', unit: 'g', category: 'Materia prima', itemType: ITEM_TYPES.MATERIA_PRIMA },
  { name: 'tomate', label: 'Tomate', unit: 'g', category: 'Materia prima', itemType: ITEM_TYPES.MATERIA_PRIMA },
  { name: 'cebolla', label: 'Cebolla', unit: 'g', category: 'Materia prima', itemType: ITEM_TYPES.MATERIA_PRIMA },
  { name: 'jalapeño', label: 'Jalapeño', unit: 'g', category: 'Materia prima', itemType: ITEM_TYPES.MATERIA_PRIMA },
  { name: 'apazote', label: 'Apazote', unit: 'g', category: 'Materia prima', itemType: ITEM_TYPES.MATERIA_PRIMA },
  { name: 'cilantro sarazo', label: 'Cilantro Sarazo', unit: 'g', category: 'Materia prima', itemType: ITEM_TYPES.MATERIA_PRIMA },
  { name: 'cilantro', label: 'Cilantro', unit: 'g', category: 'Materia prima', itemType: ITEM_TYPES.MATERIA_PRIMA },
  { name: 'yogurth griego', label: 'Yogurth Griego', unit: 'g', category: 'Materia prima', itemType: ITEM_TYPES.MATERIA_PRIMA },
  { name: 'chile pasa', label: 'Chile Pasa', unit: 'g', category: 'Materia prima', itemType: ITEM_TYPES.MATERIA_PRIMA },
  { name: 'chile guaque', label: 'Chile Guaque', unit: 'g', category: 'Materia prima', itemType: ITEM_TYPES.MATERIA_PRIMA },
  { name: 'chorizo', label: 'Chorizo', unit: 'g', category: 'Materia prima', itemType: ITEM_TYPES.MATERIA_PRIMA },
  { name: 'badilla', label: 'Badilla', unit: 'g', category: 'Materia prima', itemType: ITEM_TYPES.MATERIA_PRIMA },
  { name: 'cubos de pollo', label: 'Cubos de Pollo', unit: 'g', category: 'Materia prima', itemType: ITEM_TYPES.MATERIA_PRIMA },
  { name: 'lomo de cerdo', label: 'Lomo de Cerdo', unit: 'g', category: 'Materia prima', itemType: ITEM_TYPES.MATERIA_PRIMA },
  { name: 'chiltepe', label: 'Chiltepe', unit: 'g', category: 'Materia prima', itemType: ITEM_TYPES.MATERIA_PRIMA },
  { name: 'aguacate', label: 'Aguacate', unit: 'und', category: 'Materia prima', itemType: ITEM_TYPES.MATERIA_PRIMA },

  // ----------------------------- INSUMOS LISTOS ----------------------------
  { name: 'aguacate hass', label: 'Aguacate Hass', unit: 'und', category: 'Complementos', itemType: ITEM_TYPES.INSUMO_LISTO, usedPerPlate: 0.5 },
  { name: 'queso', label: 'Queso', unit: 'g', category: 'Ingredientes fijos', itemType: ITEM_TYPES.INSUMO_LISTO, usedPerPlate: 60 },
  { name: 'queso extra', label: 'Queso Extra', unit: 'g', category: 'Complementos', itemType: ITEM_TYPES.INSUMO_LISTO, usedPerPlate: 30 },
  { name: 'crema', label: 'Crema', unit: 'ml', category: 'Base', itemType: ITEM_TYPES.INSUMO_LISTO, usedPerPlate: 25 },
  { name: 'totopos', label: 'Totopos', unit: 'g', category: 'Ingredientes fijos', itemType: ITEM_TYPES.INSUMO_LISTO, usedPerPlate: 80 },
  { name: 'tenedor', label: 'Tenedor', unit: 'und', category: 'Empaque', itemType: ITEM_TYPES.INSUMO_LISTO, usedPerPlate: 1 },
  { name: 'servilleta', label: 'Servilleta', unit: 'und', category: 'Empaque', itemType: ITEM_TYPES.INSUMO_LISTO, usedPerPlate: 2 },
  { name: 'sticker', label: 'Sticker', unit: 'und', category: 'Empaque', itemType: ITEM_TYPES.INSUMO_LISTO, usedPerPlate: 1 },
  { name: 'bolsa kraft', label: 'Bolsa Kraft', unit: 'und', category: 'Empaque', itemType: ITEM_TYPES.INSUMO_LISTO, usedPerPlate: 1, consumptionType: 'order' },
  // Llaves historicas: el nombre interno se conserva para no romper ordenes,
  // lotes ni logs ya registrados; lo que cambia es la etiqueta visible.
  { name: 'plato de 4 onz', label: 'Plato 4 oz', unit: 'und', category: 'Empaque', itemType: ITEM_TYPES.INSUMO_LISTO, usedPerPlate: 1 },
  { name: 'tapadera de 4 onz', label: 'Tapa 4 oz', unit: 'und', category: 'Empaque', itemType: ITEM_TYPES.INSUMO_LISTO, usedPerPlate: 1 },
  { name: 'plato de 8 onz', label: 'Plato 8 oz', unit: 'und', category: 'Empaque', itemType: ITEM_TYPES.INSUMO_LISTO, usedPerPlate: 1 },
  { name: 'tapadera de 8 onz', label: 'Tapa 8 oz', unit: 'und', category: 'Empaque', itemType: ITEM_TYPES.INSUMO_LISTO, usedPerPlate: 1 },
  { name: 'plato rectangular', label: 'Plato y Tapa 32 oz', unit: 'und', category: 'Empaque', itemType: ITEM_TYPES.INSUMO_LISTO, usedPerPlate: 1 },
  { name: 'plato familiar', label: 'Plato Familiar', unit: 'und', category: 'Empaque', itemType: ITEM_TYPES.INSUMO_LISTO, usedPerPlate: 1 },
  { name: 'plato papel familiar', label: 'Plato Papel Familiar', unit: 'und', category: 'Empaque', itemType: ITEM_TYPES.INSUMO_LISTO, usedPerPlate: 1 },

  // --------------------------- PRODUCTO TERMINADO --------------------------
  { name: 'salsa roja', label: 'Salsa Roja', unit: 'ml', category: 'Salsas', itemType: ITEM_TYPES.PRODUCTO_TERMINADO, usedPerPlate: SAUCE_FULL_PORTION_ML, displayUsedPerPlate: 200, displayUnit: 'ml', process: 'licuado' },
  { name: 'salsa verde', label: 'Salsa Verde', unit: 'ml', category: 'Salsas', itemType: ITEM_TYPES.PRODUCTO_TERMINADO, usedPerPlate: SAUCE_FULL_PORTION_ML, displayUsedPerPlate: 200, displayUnit: 'ml', process: 'licuado' },
  { name: 'cebolla picada', label: 'Cebolla Picada', unit: 'g', category: 'Base', itemType: ITEM_TYPES.PRODUCTO_TERMINADO, usedPerPlate: 15, process: 'picado' },
  { name: 'cilantro picado', label: 'Cilantro Picado', unit: 'g', category: 'Base', itemType: ITEM_TYPES.PRODUCTO_TERMINADO, usedPerPlate: 10, process: 'picado' },
  { name: 'cebolla caramelizada', label: 'Cebolla Caramelizada', unit: 'g', category: 'Complementos', itemType: ITEM_TYPES.PRODUCTO_TERMINADO, usedPerPlate: 30, process: 'caramelizado' },
  { name: 'steak', label: 'Steak', unit: 'g', category: 'Proteínas', itemType: ITEM_TYPES.PRODUCTO_TERMINADO, usedPerPlate: 60, process: 'asado' },
  { name: 'pollo', label: 'Pollo', unit: 'g', category: 'Proteínas', itemType: ITEM_TYPES.PRODUCTO_TERMINADO, usedPerPlate: 60, process: 'cocido' },
  { name: 'pulled pork', label: 'Pulled Pork', unit: 'g', category: 'Proteínas', itemType: ITEM_TYPES.PRODUCTO_TERMINADO, usedPerPlate: 60, process: 'deshebrado' },
  { name: 'chorizo argentino', label: 'Chorizo Argentino', unit: 'g', category: 'Proteínas', itemType: ITEM_TYPES.PRODUCTO_TERMINADO, usedPerPlate: 60, process: 'asado' },
  // Sin usedPerPlate a proposito: cuanto picante lleva un plato es una
  // decision de negocio que todavia no esta tomada. Sin porcion no entra al
  // consumo por plato ni a las alertas de stock — se le asigna desde
  // Produccion > Ensamblaje cuando se defina.
  { name: 'picante', label: 'Picante', unit: 'ml', category: 'Otros', itemType: ITEM_TYPES.PRODUCTO_TERMINADO, process: 'licuado' }
]

export const INVENTORY_CATALOG_MAP = Object.fromEntries(INVENTORY_CATALOG.map((item) => [item.name, item]))
export const ALLOWED_INVENTORY_NAMES = INVENTORY_CATALOG.map((item) => item.name)

export const getCatalogItemType = (name = '') =>
  INVENTORY_CATALOG_MAP[String(name).trim().toLowerCase()]?.itemType || null

// Etiqueta visible de cualquier nombre interno. Si el producto no esta en el
// catalogo base (creado a mano por el admin) se capitaliza palabra por palabra
// para que NUNCA se muestre algo en minuscula inicial.
export const toDisplayLabel = (name = '') => {
  const normalized = String(name || '').trim().toLowerCase()
  if (!normalized) return ''
  const catalogItem = INVENTORY_CATALOG_MAP[normalized]
  if (catalogItem?.label) return catalogItem.label
  const MINOR_WORDS = ['de', 'del', 'y', 'la', 'el', 'con', 'a', 'en']
  return normalized
    .split(/\s+/)
    .map((word, index) => (index > 0 && MINOR_WORDS.includes(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ')
}

// Consumo por plato de los productos que SI llegan al plato (insumo listo y
// producto terminado). Ojo: aqui ya no aparece materia prima — un plato nunca
// consume cebolla cruda, consume "cebolla picada" (producto terminado).
export const DEFAULT_RECIPE_CONSUMPTION = {
  'totopos': 80,
  'queso': 60,
  'crema': 25,
  'cebolla picada': 15,
  'cilantro picado': 10,
  'salsa roja': SAUCE_FULL_PORTION_ML,
  'salsa verde': SAUCE_FULL_PORTION_ML,
  'steak': 60,
  'pollo': 60,
  'chorizo argentino': 60,
  'pulled pork': 60,
  'aguacate hass': 0.5,
  'cebolla caramelizada': 30,
  'queso extra': 30,
}

export const PACKAGING_CONSUMPTION = {
  'plato rectangular': 1,
  'tenedor': 1,
  'servilleta': 2,
  'sticker': 1
}

// Mapa de compatibilidad: opciones historicas del menu (y ordenes ya
// registradas) que apuntaban a materia prima y ahora deben descontar el
// producto terminado correspondiente.
export const LEGACY_STOCK_NAME_MAP = {
  'cebolla': 'cebolla picada',
  'cilantro': 'cilantro picado',
  'chorizo': 'chorizo argentino',
  'aguacate': 'aguacate hass'
}

export const resolveStockName = (name = '') => {
  const normalized = String(name || '').trim().toLowerCase()
  return LEGACY_STOCK_NAME_MAP[normalized] || normalized
}
