const userService = require('../services/user.service');

const getPendingUsers = async (req, res) => {
  try {
    const users = await userService.getPendingUsers();
    res.json({ users });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateUserStatus = async (req, res) => {
  try {
    const { status, role } = req.body;
    const user = await userService.updateUserStatus(req.params.id, status, role);
    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getPendingUsers, updateUserStatus };
