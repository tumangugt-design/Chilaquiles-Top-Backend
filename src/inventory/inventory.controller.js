import Inventory from './inventory.model.js';
import { getAggregatedConsumption, validateInventoryAvailability } from './inventory.service.js';

export const getInventoryItems = async (req, res) => {
  try {
    const items = await Inventory.find().sort({ name: 1 });
    return res.status(200).json(items);
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching inventory', error: error.message });
  }
};

export const saveInventoryItem = async (req, res) => {
  try {
    const payload = {
      name: String(req.body.name || '').trim().toLowerCase(),
      unit: req.body.unit,
      stock: Number(req.body.stock || 0),
      minimumStock: Number(req.body.minimumStock || 0),
      notes: req.body.notes || ''
    };

    const item = await Inventory.findOneAndUpdate(
      { name: payload.name },
      payload,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({ message: 'Inventory item saved successfully', item });
  } catch (error) {
    return res.status(500).json({ message: 'Error saving inventory item', error: error.message });
  }
};

export const previewRecipeConsumption = async (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const validation = await validateInventoryAvailability(items);
    return res.status(200).json({
      consumption: getAggregatedConsumption(items),
      validation,
      futurePhase: 'Ready for detailed recipe breakdown per plate and sub-ingredient.'
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error generating recipe preview', error: error.message });
  }
};
