const User = require('../models/User');

const loginClient = async (firebaseUser, clientData) => {
  let user = await User.findOne({ firebaseUid: firebaseUser.uid });
  
  if (!user) {
    user = new User({
      firebaseUid: firebaseUser.uid,
      name: clientData.name || 'Cliente',
      phone: clientData.phone || firebaseUser.phone_number,
      address: clientData.address,
      role: 'CLIENT',
      status: 'approved'
    });
    await user.save();
  }
  return user;
};

const loginStaff = async (firebaseUser) => {
  let user = await User.findOne({ firebaseUid: firebaseUser.uid });
  
  if (!user) {
    user = new User({
      firebaseUid: firebaseUser.uid,
      name: firebaseUser.name || 'Staff',
      email: firebaseUser.email,
      role: 'CHEF', // Default role for new staff, admin can change
      status: 'pending'
    });
    await user.save();
  }
  return user;
};

module.exports = { loginClient, loginStaff };
