import User from './user.model.js';
import { USER_ROLES, USER_STATUS } from '../helpers/constants.js';
import { normalizePhone } from '../helpers/order.helper.js';

export const findUserByFirebaseUid = async (firebaseUid) => User.findOne({ firebaseUid });

export const upsertClientUser = async ({ firebaseUid, phone, name, address, location }) => {
  const normalizedPhone = normalizePhone(phone);
  let user = await findUserByFirebaseUid(firebaseUid);

  if (!user) {
    user = await User.create({
      firebaseUid,
      phone: normalizedPhone,
      name,
      address,
      location,
      role: USER_ROLES.CLIENT,
      status: USER_STATUS.APPROVED
    });
    return user;
  }

  user.phone = normalizedPhone || user.phone;
  user.name = name || user.name;
  user.address = address || user.address;
  user.location = location || user.location;
  user.role = USER_ROLES.CLIENT;
  user.status = USER_STATUS.APPROVED;
  await user.save();
  return user;
};

export const upsertStaffUser = async ({ firebaseUid, email, name, phone, requestedRole }) => {
  let user = await findUserByFirebaseUid(firebaseUid);

  if (!user) {
    user = await User.create({
      firebaseUid,
      email,
      phone: normalizePhone(phone),
      name,
      role: requestedRole,
      status: USER_STATUS.PENDING
    });
    return user;
  }

  user.email = email || user.email;
  user.phone = normalizePhone(phone) || user.phone;
  user.name = name || user.name;
  if (user.role !== USER_ROLES.ADMIN) {
    user.role = requestedRole || user.role;
  }
  await user.save();
  return user;
};

export const listPendingStaffUsers = async () => User.find({
  role: { $in: [USER_ROLES.REPARTIDOR, USER_ROLES.CHEF] },
  status: USER_STATUS.PENDING
}).sort({ createdAt: -1 });

export const updateStaffApproval = async ({ userId, status, role }) => {
  const user = await User.findById(userId);
  if (!user) return null;
  user.status = status || user.status;
  if (role && [USER_ROLES.REPARTIDOR, USER_ROLES.CHEF].includes(role)) {
    user.role = role;
  }
  await user.save();
  return user;
};

export const seedAdminUser = async () => {
  const adminUid = process.env.ADMIN_FIREBASE_UID;
  if (!adminUid) return;

  const existing = await findUserByFirebaseUid(adminUid);
  if (existing) return;

  await User.create({
    firebaseUid: adminUid,
    email: process.env.ADMIN_EMAIL,
    name: process.env.ADMIN_NAME || 'Admin',
    role: USER_ROLES.ADMIN,
    status: USER_STATUS.APPROVED
  });
};
