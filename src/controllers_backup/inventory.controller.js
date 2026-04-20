const inventoryService = require('../services/inventory.service');

const getInventory = async (req, res) => {
  try {
    const inventory = await inventoryService.getInventory();
    res.json({ inventory });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const addInventory = async (req, res) => {
  try {
    const { name, quantity, unit } = req.body;
    const item = await inventoryService.addInventory(name, quantity, unit);
    res.json({ item });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getInventory, addInventory };
