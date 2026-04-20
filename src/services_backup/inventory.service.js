const Inventory = require('../models/Inventory');

const deductForOrder = async (order) => {
  const platesCount = order.items.length;
  if (platesCount === 0) return;

  // Example logic: 1 order = 0.5 lbs carne, 0.2 litros salsa
  
  let salsaRojaReq = 0;
  let salsaVerdeReq = 0;
  let carneReq = 0;
  let polloReq = 0;
  let chorizoReq = 0;

  order.items.forEach(item => {
    if (item.sauce === 'ROJA') salsaRojaReq += 0.2;
    if (item.sauce === 'VERDE') salsaVerdeReq += 0.2;
    if (item.sauce === 'DIVORCIADOS') { salsaRojaReq += 0.1; salsaVerdeReq += 0.1; }
    
    if (item.protein === 'STEAK') carneReq += 0.5;
    if (item.protein === 'POLLO') polloReq += 0.5;
    if (item.protein === 'CHORIZO') chorizoReq += 0.5;
  });

  await deductItem('salsa roja', salsaRojaReq);
  await deductItem('salsa verde', salsaVerdeReq);
  await deductItem('carne', carneReq);
  await deductItem('pollo', polloReq);
  await deductItem('chorizo', chorizoReq);
};

const deductItem = async (name, quantity) => {
  if (quantity <= 0) return;
  await Inventory.findOneAndUpdate(
    { name: { $regex: new RegExp(`^${name}$`, 'i') } },
    { $inc: { quantity: -quantity } }
  );
};

const getInventory = async () => {
  return await Inventory.find();
};

const addInventory = async (name, quantity, unit) => {
  return await Inventory.findOneAndUpdate(
    { name },
    { $inc: { quantity }, $setOnInsert: { unit } },
    { upsert: true, new: true }
  );
};

module.exports = { deductForOrder, getInventory, addInventory };
