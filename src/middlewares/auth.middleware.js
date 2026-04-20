import { auth } from '../config/firebase.js';
import User from '../users/user.model.js';

export const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decodedToken = await auth.verifyIdToken(token);
    const user = await User.findOne({ firebaseUid: decodedToken.uid });
    
    // We pass decodedToken too in case it's a new registration and user is not in DB yet
    req.firebaseUser = decodedToken;
    req.user = user; 
    
    next();
  } catch (error) {
    console.error('Error verifying token:', error);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};
