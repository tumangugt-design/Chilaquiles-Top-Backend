
import { listUsersByRole, createLocalStaffUser, updateStaffUser, deleteUser } from './user.service.js';

export const createStaffUser = async (req, res) => {
  try {
    const user = await createLocalStaffUser({
      name: req.body.name,
      phone: req.body.phone,
      username: req.body.username,
      password: req.body.password,
      requestedRole: req.body.role,
    });
    return res.status(201).json({ message: 'Usuario creado exitosamente', user });
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Error al crear usuario' });
  }
};

export const patchStaffUser = async (req, res) => {
  try {
    const user = await updateStaffUser(req.params.id, req.body);
    return res.status(200).json({ message: 'Usuario actualizado exitosamente', user });
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Error al actualizar usuario' });
  }
};

export const deleteStaffUser = async (req, res) => {
  try {
    await deleteUser(req.params.id);
    return res.status(200).json({ message: 'Usuario eliminado exitosamente' });
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Error al eliminar usuario' });
  }
};

export const getUsersByRole = async (req, res) => {
  try {
    const users = await listUsersByRole(req.params.role);
    return res.status(200).json(users);
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching users by role', error: error.message });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { updateUserProfile } = await import('./user.service.js');
    const user = await updateUserProfile(req.user._id, req.body);
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.status(200).json({ message: 'Profile updated successfully', user });
  } catch (error) {
    return res.status(500).json({ message: 'Error updating profile', error: error.message });
  }
};

