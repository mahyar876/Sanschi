const express = require('express');
const router = express.Router();
const Pitch = require('../models/Pitch');
const DailyAvailability = require('../models/DailyAvailability');
const { protect, adminOnly } = require('../middleware/authController');

function adminSecret(req, res, next) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return next();
  const incoming = req.headers['x-admin-secret'];
  if (incoming && incoming === secret) return next();
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    return protect(req, res, () => adminOnly(req, res, next));
  }
  return res
    .status(401)
    .json({ success: false, message: 'دسترسی ادمین لازمه' });
}

// ─────────────────────────────────────
// GET /api/pitches
// ─────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { type, size, sort, all } = req.query;
    const filter = {};
    if (!all) filter.isActive = true;
    if (type) filter.type = type;
    if (size) filter.size = parseInt(size);

    let query = Pitch.find(filter);
    if (sort === 'price') query = query.sort({ price: 1 });
    else if (sort === 'price-desc') query = query.sort({ price: -1 });
    else query = query.sort({ createdAt: 1 });

    const pitches = await query;

    const data = pitches.map((p) => {
      const pObj = p.toJSON();

      // کمیسیون این زمین از Pitch.commissionAmount
      const pitchCommission = p.commissionAmount || 0;

      // هر سانس → sitePrice = price + pitchCommission
      const slotsWithSitePrice = (p.slots || []).map((s) => {
        const sObj = s.toObject ? s.toObject() : { ...s };
        const sitePrice = s.price + pitchCommission;
        return { ...sObj, commission: pitchCommission, sitePrice };
      });

      // کمترین قیمت پایه (بدون کمیسیون) برای نمایش روی کارت
      const slotPrices = (p.slots || []).map((s) => s.price);
      const minPrice = slotPrices.length ? Math.min(...slotPrices) : p.price;

      return {
        ...pObj,
        slots: slotsWithSitePrice,
        price: minPrice, // قیمت پایه واقعی زمین
        commissionAmount: pitchCommission, // کمیسیون سانس‌چی
        avail: p.slots.filter((s) => !s.taken).length,
      };
    });

    if (sort === 'avail') data.sort((a, b) => b.avail - a.avail);

    res.json({ success: true, count: data.length, pitches: data });
  } catch (err) {
    console.error('GET /pitches error:', err);
    res.status(500).json({ success: false, message: 'خطای سرور' });
  }
});

// ─────────────────────────────────────
// GET /api/pitches/:id
// ─────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const pitch = await Pitch.findById(req.params.id);
    if (!pitch)
      return res.status(404).json({ success: false, message: 'زمین پیدا نشد' });

    const pObj = pitch.toJSON();
    const pitchCommission = pitch.commissionAmount || 0;
    const slotsWithSitePrice = (pitch.slots || []).map((s) => {
      const sObj = s.toObject ? s.toObject() : { ...s };
      return {
        ...sObj,
        commission: pitchCommission,
        sitePrice: s.price + pitchCommission,
      };
    });

    res.json({
      success: true,
      pitch: {
        ...pObj,
        slots: slotsWithSitePrice,
        commissionAmount: pitchCommission,
        avail: pitch.slots.filter((s) => !s.taken).length,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطای سرور' });
  }
});

// ─────────────────────────────────────
// GET /api/pitches/:id/slots?date=1403/03/24
// ─────────────────────────────────────
router.get('/:id/slots', async (req, res) => {
  try {
    const pitch = await Pitch.findById(req.params.id).select(
      'slots name commissionAmount',
    );
    if (!pitch)
      return res.status(404).json({ success: false, message: 'زمین پیدا نشد' });

    const { date } = req.query;

    // بدون تاریخ → template زمین
    if (!date) {
      const pitchComm = pitch.commissionAmount || 0;
      const slots = pitch.slots.map((s) => {
        const sObj = s.toObject ? s.toObject() : { ...s };
        return {
          ...sObj,
          commission: pitchComm,
          sitePrice: s.price + pitchComm,
        };
      });
      return res.json({ success: true, slots });
    }

    // با تاریخ → DailyAvailability
    let daily = await DailyAvailability.findOne({
      pitch: req.params.id,
      date,
    });

    const pitchComm = pitch.commissionAmount || 0;
    if (!daily) {
      const slots = pitch.slots.map((s, i) => ({
        slotIndex: i,
        time: s.time,
        price: s.price,
        commission: pitchComm,
        sitePrice: s.price + pitchComm,
        taken: false,
        takenBy: null,
        reservationId: null,
      }));
      daily = await DailyAvailability.create({
        pitch: req.params.id,
        date,
        slots,
      });
    }

    // اگه daily از قبل وجود داشت، sitePrice با pitchComm بساز
    const slots = daily.slots.map((s) => {
      const sObj = s.toObject ? s.toObject() : { ...s };
      return {
        ...sObj,
        commission: pitchComm,
        sitePrice: s.price + pitchComm,
      };
    });

    res.json({ success: true, slots });
  } catch (err) {
    console.error('GET /slots error:', err);
    res.status(500).json({ success: false, message: 'خطای سرور' });
  }
});

// ─────────────────────────────────────
// POST /api/pitches  (ادمین)
// ─────────────────────────────────────
router.post('/', adminSecret, async (req, res) => {
  try {
    const pitch = await Pitch.create(req.body);
    res.status(201).json({ success: true, pitch });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const msg = Object.values(err.errors)
        .map((e) => e.message)
        .join(' | ');
      return res.status(400).json({ success: false, message: msg });
    }
    res.status(500).json({ success: false, message: 'خطای سرور' });
  }
});

// ─────────────────────────────────────
// PATCH /api/pitches/:id  (ادمین)
// ─────────────────────────────────────
router.patch('/:id', adminSecret, async (req, res) => {
  try {
    const pitch = await Pitch.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!pitch)
      return res.status(404).json({ success: false, message: 'زمین پیدا نشد' });
    res.json({ success: true, pitch });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────
// DELETE /api/pitches/:id  (ادمین)
// ─────────────────────────────────────
router.delete('/:id', adminSecret, async (req, res) => {
  try {
    await Pitch.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'زمین غیرفعال شد' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطای سرور' });
  }
});

// ─────────────────────────────────────
// PATCH /api/pitches/:id/assign-owner  (ادمین)
// اتصال یک زمین به یک کاربر (با شماره موبایل)
// بدنه: { phone: "09121234567" }
// ─────────────────────────────────────
router.patch('/:id/assign-owner', protect, adminOnly, async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res
        .status(400)
        .json({ success: false, message: 'شماره موبایل الزامی است' });
    }

    const User = require('../models/User');
    const user = await User.findOne({ phone });
    if (!user) {
      return res
        .status(404)
        .json({
          success: false,
          message:
            'کاربری با این شماره پیدا نشد. ابتدا باید در سایت ثبت‌نام کند.',
        });
    }

    const pitch = await Pitch.findByIdAndUpdate(
      req.params.id,
      { owner: user._id },
      { new: true },
    ).populate('owner', 'name phone email');

    if (!pitch) {
      return res.status(404).json({ success: false, message: 'زمین پیدا نشد' });
    }

    res.json({
      success: true,
      message: `زمین "${pitch.name}" به ${user.name} (${user.phone}) متصل شد`,
      pitch,
    });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: 'خطای سرور: ' + err.message });
  }
});

// ─────────────────────────────────────
// DELETE /api/pitches/:id/remove-owner  (ادمین)
// حذف مالک از یک زمین
// ─────────────────────────────────────
router.delete('/:id/remove-owner', protect, adminOnly, async (req, res) => {
  try {
    const pitch = await Pitch.findByIdAndUpdate(
      req.params.id,
      { owner: null },
      { new: true },
    );

    if (!pitch) {
      return res.status(404).json({ success: false, message: 'زمین پیدا نشد' });
    }

    res.json({
      success: true,
      message: `مالک از زمین "${pitch.name}" حذف شد`,
      pitch,
    });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: 'خطای سرور: ' + err.message });
  }
});

module.exports = router;
