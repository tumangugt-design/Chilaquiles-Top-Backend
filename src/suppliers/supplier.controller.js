import Supplier from './supplier.model.js';
import Inventory from '../inventory/inventory.model.js';

export const getSuppliers = async (req, res) => {
  try {
    const suppliers = await Supplier.find().sort({ name: 1 });
    return res.status(200).json(suppliers);
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching suppliers', error: error.message });
  }
};

export const createSupplier = async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ message: 'El nombre del proveedor es requerido.' });
    }

    const existing = await Supplier.findOne({ name });
    if (existing) {
      return res.status(400).json({ message: 'Ya existe un proveedor con ese nombre.' });
    }

    const supplier = await Supplier.create({
      name,
      contactName: req.body.contactName || '',
      phone: req.body.phone || '',
      email: req.body.email || '',
      notes: req.body.notes || ''
    });

    return res.status(200).json({ message: 'Proveedor creado exitosamente', supplier });
  } catch (error) {
    return res.status(500).json({ message: 'Error creating supplier', error: error.message });
  }
};

export const updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const update = {};

    if (req.body.name !== undefined) {
      const name = String(req.body.name || '').trim();
      if (!name) {
        return res.status(400).json({ message: 'El nombre del proveedor es requerido.' });
      }
      const existing = await Supplier.findOne({ name, _id: { $ne: id } });
      if (existing) {
        return res.status(400).json({ message: 'Ya existe un proveedor con ese nombre.' });
      }
      update.name = name;
    }

    if (req.body.contactName !== undefined) update.contactName = req.body.contactName;
    if (req.body.phone !== undefined) update.phone = req.body.phone;
    if (req.body.email !== undefined) update.email = req.body.email;
    if (req.body.notes !== undefined) update.notes = req.body.notes;
    if (req.body.isActive !== undefined) update.isActive = !!req.body.isActive;

    const supplier = await Supplier.findByIdAndUpdate(id, { $set: update }, { new: true });
    if (!supplier) {
      return res.status(404).json({ message: 'Proveedor no encontrado' });
    }

    return res.status(200).json({ message: 'Proveedor actualizado exitosamente', supplier });
  } catch (error) {
    return res.status(500).json({ message: 'Error updating supplier', error: error.message });
  }
};

export const deleteSupplier = async (req, res) => {
  try {
    const { id } = req.params;

    const inUseCount = await Inventory.countDocuments({ supplierId: id });
    if (inUseCount > 0) {
      return res.status(400).json({
        message: `No se puede eliminar: ${inUseCount} producto(s) de inventario usan este proveedor. Reasígnalos primero.`
      });
    }

    const supplier = await Supplier.findByIdAndDelete(id);
    if (!supplier) {
      return res.status(404).json({ message: 'Proveedor no encontrado' });
    }

    return res.status(200).json({ message: 'Proveedor eliminado exitosamente' });
  } catch (error) {
    return res.status(500).json({ message: 'Error deleting supplier', error: error.message });
  }
};
