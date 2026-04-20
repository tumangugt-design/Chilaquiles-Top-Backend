const User = require('../models/User');

const getPendingUsers = async () => {
  return await User.find({ status: 'pending' });
};

const updateUserStatus = async (userId, status, role) => {
  const updates = { status };
  if (role) updates.role = role;
  
  return await User.findByIdAndUpdate(userId, updates, { new: true });
};

module.exports = { getPendingUsers, updateUserStatus };
