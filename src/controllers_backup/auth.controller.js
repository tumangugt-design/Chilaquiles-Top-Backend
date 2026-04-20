const authService = require('../services/auth.service');

const loginClient = async (req, res) => {
  try {
    const user = await authService.loginClient(req.firebaseUser, req.body);
    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const loginStaff = async (req, res) => {
  try {
    const user = await authService.loginStaff(req.firebaseUser);
    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { loginClient, loginStaff };
