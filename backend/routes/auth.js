const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect, signToken } = require('../middleware/authController');

// ── پاسخ با توکن ──
function sendToken(res, user, statusCode = 200) {
  const token = signToken(user._id);
  res.status(statusCode).json({
    success: true,
    token,
    user: {
      id: user._id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
    },
  });
}

// ─────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────
router.post('/register', async (req, res) => {
  console.log('📥 REGISTER STARTED');
  console.log('Request body:', req.body);

  try {
    const { name, phone, email, password } = req.body;

    const exists = await User.findOne({ phone });
    if (exists) {
      return res
        .status(400)
        .json({ success: false, message: 'این شماره قبلاً ثبت شده' });
    }

    const emailValue =
      email && email.trim() !== '' ? email.trim().toLowerCase() : undefined;

    const payload = { name, phone, password };
    if (emailValue) payload.email = emailValue;

    const user = await User.create(payload);

    console.log('✅ User created:', user._id);
    sendToken(res, user, 201);
  } catch (err) {
    console.error('❌ REGISTER ERROR:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────
// POST /api/auth/login  (ایمیل + رمز)
// ─────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('🔐 LOGIN attempt:', email);

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: 'ایمیل و رمز عبور الزامی است' });
    }

    const user = await User.findOne({ email }).select('+password');
    console.log(
      '👤 User found:',
      !!user,
      '| has password:',
      !!(user && user.password),
    );

    if (!user || !user.password) {
      console.log('❌ user not found or no password');
      return res
        .status(401)
        .json({ success: false, message: 'اطلاعات اشتباه است' });
    }

    const ok = await user.comparePassword(password);
    console.log('🔑 password match:', ok, '| role:', user.role);

    if (!ok) {
      return res
        .status(401)
        .json({ success: false, message: 'اطلاعات اشتباه است' });
    }

    console.log('✅ LOGIN success:', email);
    sendToken(res, user);
  } catch (err) {
    console.error('❌ LOGIN ERROR:', err.message);
    res.status(500).json({ success: false, message: 'خطای سرور' });
  }
});

// ─────────────────────────────────────
// POST /api/auth/send-otp
// OTP فقط تو console چاپ میشه — لوکال دستی وارد کن
// ─────────────────────────────────────
const otpStore = new Map();

router.post('/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!/^09[0-9]{9}$/.test(phone)) {
      return res
        .status(400)
        .json({ success: false, message: 'شماره معتبر نیست' });
    }

    // چک کن کاربر قبلاً ثبت‌نام کرده یا نه
    const userExists = await User.findOne({ phone });
    if (!userExists) {
      return res.status(404).json({
        success: false,
        message: 'این شماره ثبت‌نام نشده — ابتدا ثبت‌نام کن',
      });
    }

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    otpStore.set(phone, { otp, expiry: Date.now() + 10 * 60 * 1000 });

    console.log('');
    console.log('┌──────────────────────────────────────┐');
    console.log(`│  📱 OTP برای ${phone}        │`);
    console.log(`│  🔑 کد: ${otp}                           │`);
    console.log('└──────────────────────────────────────┘');
    console.log('');

    res.json({
      success: true,
      message: 'کد OTP تو ترمینال سرور چاپ شد',
      dev_otp: otp,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطای سرور' });
  }
});

// ─────────────────────────────────────
// POST /api/auth/verify-otp
// ─────────────────────────────────────
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;
    const record = otpStore.get(phone);

    if (!record) {
      return res
        .status(400)
        .json({ success: false, message: 'ابتدا رمز درخواست کن' });
    }
    if (Date.now() > record.expiry) {
      otpStore.delete(phone);
      return res.status(400).json({ success: false, message: 'رمز منقضی شده' });
    }
    if (record.otp !== otp) {
      return res
        .status(400)
        .json({ success: false, message: 'رمز اشتباه است' });
    }

    otpStore.delete(phone);

    let user = await User.findOne({ phone });
    if (!user) {
      user = await User.create({ name: 'کاربر جدید', phone });
    }

    console.log('✅ OTP تأیید شد برای:', phone);
    sendToken(res, user);
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطای سرور' });
  }
});

// ─────────────────────────────────────
// GET /api/auth/me
// ─────────────────────────────────────
router.get('/me', protect, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      phone: req.user.phone,
      email: req.user.email,
      role: req.user.role,
    },
  });
});

// ─────────────────────────────────────
// PATCH /api/auth/me
// ─────────────────────────────────────
router.patch('/me', protect, async (req, res) => {
  try {
    const { name, email } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, email },
      { new: true, runValidators: true },
    );
    res.json({ success: true, user });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
