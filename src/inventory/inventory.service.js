import Inventory from './inventory.model.js';
import { DEFAULT_RECIPE_CONSUMPTION } from '../helpers/constants.js';

const round = (value) => Math.round(value * 1000) / 1000;

const normalizeName = (value = '') => value.trim().toLowerCase();

const getConsumptionForItem = (item) => {
  const consumption = {
    totopos: DEFAULT_RECIPE_CONSUMPTION['totopos']
  };

  if (item.sauce === 'ROJA') {
    consumption['salsa roja'] = DEFAULT_RECIPE_CONSUMPTION['salsa roja'];
  } else if (item.sauce === 'VERDE') {
    consumption['salsa verde'] = DEFAULT_RECIPE_CONSUMPTION['salsa verde'];
  } else if (item.sauce === 'DIVORCIADOS') {
    consumption['salsa roja'] = DEFAULT_RECIPE_CONSUMPTION['salsa roja'] / 2;
    consumption['salsa verde'] = DEFAULT_RECIPE_CONSUMPTION['salsa verde'] / 2;
  }

  if (item.protein === 'STEAK') consumption['carne'] = DEFAULT_RECIPE_CONSUMPTION['carne'];
  if (item.protein === 'POLLO') consumption['pollo'] = DEFAULT_RECIPE_CONSUMPTION['pollo'];
  if (item.protein === 'CHORIZO') consumption['chorizo'] = DEFAULT_RECIPE_CONSUMPTION['chorizo'];

  if (item.complement === 'AGUACATE') consumption['aguacate'] = DEFAULT_RECIPE_CONSUMPTION['aguacate'];
  if (item.complement === 'CEBOLLA_CARAMELIZADA') consumption['cebolla caramelizada'] = DEFAULT_RECIPE_CONSUMPTION['cebolla caramelizada'];
  if (item.complement === 'QUESO_EXTRA') consumption['queso extra'] = DEFAULT_RECIPE_CONSUMPTION['queso extra'];

  if (item.baseRecipe?.onion) consumption['cebolla'] = DEFAULT_RECIPE_CONSUMPTION['cebolla'];
  if (item.baseRecipe?.cilantro) consumption['cilantro'] = DEFAULT_RECIPE_CONSUMPTION['cilantro'];
  if (item.baseRecipe?.cream) consumption['crema'] = DEFAULT_RECIPE_CONSUMPTION['crema'];

  return consumption;
};

export const getAggregatedConsumption = (items = []) => {
  const aggregated = {};
  items.forEach((item) => {
    const consumption = getConsumptionForItem(item);
    Object.entries(consumption).forEach(([name, qty]) => {
      aggregated[name] = round((aggregated[name] || 0) + qty);
    });
  });
  return aggregated;
};

export const validateInventoryAvailability = async (items = []) => {
  const aggregated = getAggregatedConsumption(items);
  const names = Object.keys(aggregated).map(normalizeName);
  const inventoryItems = await Inventory.find({ name: { $in: names } });

  const currentByName = new Map(inventoryItems.map((item) => [item.name, item]));
  const shortages = [];

  Object.entries(aggregated).forEach(([name, required]) => {
    const current = currentByName.get(normalizeName(name));
    if (!current) {
      shortages.push({ ingredient: name, required, available: 0, reason: 'Ingredient not registered in inventory' });
      return;
    }
    if (current.stock < required) {
      shortages.push({ ingredient: name, required, available: current.stock, reason: 'Insufficient stock' });
    }
  });

  return { ok: shortages.length === 0, shortages, consumption: aggregated };
};

export const discountInventoryForOrder = async (items = []) => {
  const { ok, shortages, consumption } = await validateInventoryAvailability(items);
  if (!ok) {
    const error = new Error('Inventory shortage detected');
    error.statusCode = 409;
    error.details = shortages;
    throw error;
  }

  await Promise.all(
    Object.entries(consumption).map(([name, qty]) =>
      Inventory.findOneAndUpdate(
        { name: normalizeName(name) },
        { $inc: { stock: -qty } },
        { new: true }
      )
    )
  );

  return consumption;
};
