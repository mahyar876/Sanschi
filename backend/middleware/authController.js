const jwt  = require('jsonwebtoken');
const User = require('../models/User');

// ── محافظت از route (لاگین لازم) ──
exports.protect = async (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'ابتدا وارد شوید' });
    }

    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = await User.findById(decoded.id);
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'کاربر پیدا نشد' });
    }

    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'توکن نامعتبر یا منقضی شده' });
  }
};

// ── فقط ادمین ──
exports.adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'دسترسی ندارید' });
  }
  next();
};

// ── ساخت JWT ──
exports.signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};
