const isApproved = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'User not authenticated' });
  }
  if (req.user.status !== 'approved') {
    return res.status(403).json({ message: 'Forbidden: Your account is pending approval or rejected' });
  }
  next();
};

module.exports = { isApproved };
