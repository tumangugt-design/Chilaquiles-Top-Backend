import { USER_ROLES } from '../helpers/constants.js';
import { upsertClientUser, upsertStaffUser } from '../users/user.service.js';

export const clientLogin = async (req, res) => {
  try {
    const { name, phone, address, location } = req.body;
    const firebaseUser = req.firebaseUser;

    const user = await upsertClientUser({
      firebaseUid: firebaseUser.uid,
      phone: firebaseUser.phone_number || phone,
      name,
      address,
      location
    });

    return res.status(200).json({
      message: 'Client authenticated successfully',
      user
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error authenticating client', error: error.message });
  }
};

export const staffLogin = async (req, res) => {
  try {
    const { role, phone } = req.body;
    const firebaseUser = req.firebaseUser;
    const requestedRole = [USER_ROLES.CHEF, USER_ROLES.REPARTIDOR].includes(role) ? role : USER_ROLES.REPARTIDOR;

    const user = await upsertStaffUser({
      firebaseUid: firebaseUser.uid,
      email: firebaseUser.email,
      name: firebaseUser.name,
      phone,
      requestedRole
    });

    return res.status(200).json({
      message: 'Staff authenticated successfully',
      user
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error authenticating staff', error: error.message });
  }
};

export const getSession = async (req, res) => {
  return res.status(200).json({
    authenticated: Boolean(req.dbUser),
    user: req.dbUser || null
  });
};
