import { listPendingStaffUsers, updateStaffApproval } from './user.service.js';

export const getPendingStaff = async (req, res) => {
  try {
    const users = await listPendingStaffUsers();
    return res.status(200).json(users);
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching pending staff users', error: error.message });
  }
};

export const approveOrRejectStaff = async (req, res) => {
  try {
    const user = await updateStaffApproval({
      userId: req.params.userId,
      status: req.body.status,
      role: req.body.role
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({ message: 'Staff status updated successfully', user });
  } catch (error) {
    return res.status(500).json({ message: 'Error updating staff user', error: error.message });
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
