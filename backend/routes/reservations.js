const express = require('express');
const router = express.Router();
const Reservation = require('../models/Reservation');
const Pitch = require('../models/Pitch');
const DailyAvailability = require('../models/DailyAvailability');
const { protect, adminOnly } = require('../middleware/authController');

// کمک: مبلغ کمیسیون ثابت سانس‌چی را برای یک زمین برمی‌گرداند (هیچ‌وقت undefined نیست)
function getPitchCommission(pitch) {
  return (pitch && pitch.commissionAmount) || 0;
}

// ─────────────────────────────────────
// POST /api/reservations  (ثبت رزرو)
// ─────────────────────────────────────
router.post('/', protect, async (req, res) => {
  try {
    const { pitchId, slotIndex, date, playerCount, note } = req.body;

    if (!date) {
      return res
        .status(400)
        .json({ success: false, message: 'تاریخ الزامی است' });
    }

    const pitch = await Pitch.findById(pitchId);
    if (!pitch || !pitch.isActive) {
      return res.status(404).json({ success: false, message: 'زمین پیدا نشد' });
    }

    // پیدا یا ساخت DailyAvailability برای این زمین + تاریخ
    let daily = await DailyAvailability.findOne({ pitch: pitchId, date });

    if (!daily) {
      const slots = pitch.slots.map((s, i) => ({
        slotIndex: i,
        time: s.time,
        price: s.price,
        taken: s.taken || false,
        takenBy: s.takenBy || null,
        reservationId: null,
      }));
      daily = await DailyAvailability.create({ pitch: pitchId, date, slots });
    }

    // پیدا کردن سانس
    const slot = daily.slots.find((s) => s.slotIndex === slotIndex);
    if (!slot) {
      return res
        .status(400)
        .json({ success: false, message: 'سانس نامعتبر است' });
    }
    if (slot.taken) {
      return res.status(400).json({
        success: false,
        message: 'این سانس در این تاریخ قبلاً رزرو شده',
      });
    }

    // amount = قیمت سانس + کمیسیون سانس‌چی (همین مبلغ رو مشتری پرداخت می‌کنه)
    // siteCommission و pitchAmount موقع تأیید پرداخت snapshot می‌شن
    const pitchCommission = pitch.commissionAmount || 0;
    const totalAmount = slot.price + pitchCommission;

    const reservation = await Reservation.create({
      user: req.user._id,
      pitch: pitchId,
      slotIndex,
      slotTime: slot.time,
      date,
      playerCount: playerCount || pitch.size,
      note: note || '',
      amount: totalAmount,
      status: 'pending',
    });

    // علامت‌گذاری اتمیک سانس — فقط اگر همین الان هم هنوز خالی باشد.
    // این از double-booking در درخواست‌های همزمان جلوگیری می‌کند.
    const claim = await DailyAvailability.updateOne(
      {
        pitch: pitchId,
        date,
        slots: { $elemMatch: { slotIndex: slotIndex, taken: false } },
      },
      {
        $set: {
          'slots.$.taken': true,
          'slots.$.takenBy': req.user._id,
          'slots.$.reservationId': reservation._id,
        },
      },
    );

    if (!claim.modifiedCount) {
      // یک نفر دیگر در همین لحظه این سانس را گرفت → رزرو ساخته‌شده را برگردان
      await Reservation.deleteOne({ _id: reservation._id });
      return res.status(409).json({
        success: false,
        message:
          'این سانس همین الان رزرو شد، لطفاً سانس یا تاریخ دیگری انتخاب کنید',
      });
    }

    res.status(201).json({
      success: true,
      message: 'رزرو ثبت شد. منتظر تأیید پرداخت...',
      reservation: {
        id: reservation._id,
        code: reservation.code,
        pitch: pitch.name,
        slotTime: slot.time,
        date,
        amount: totalAmount,
        status: 'pending',
      },
    });
  } catch (err) {
    console.error('POST /reservations error:', err);
    res.status(500).json({ success: false, message: 'خطای سرور' });
  }
});

// ─────────────────────────────────────
// POST /api/reservations/recurring
// ─────────────────────────────────────
router.post('/recurring', protect, async (req, res) => {
  try {
    const { pitchId, slotIndex, dates, playerCount, note } = req.body;
    if (!Array.isArray(dates) || !dates.length) {
      return res
        .status(400)
        .json({ success: false, message: 'تاریخ‌ها الزامی است' });
    }
    const pitch = await Pitch.findById(pitchId);
    if (!pitch || !pitch.isActive) {
      return res.status(404).json({ success: false, message: 'زمین پیدا نشد' });
    }
    const groupId =
      'RG-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
    const created = [];
    const skipped = [];
    for (const date of dates) {
      let daily = await DailyAvailability.findOne({ pitch: pitchId, date });
      if (!daily) {
        const slots = pitch.slots.map((s, i) => ({
          slotIndex: i,
          time: s.time,
          price: s.price,
          taken: s.taken || false,
          takenBy: s.takenBy || null,
          reservationId: null,
        }));
        daily = await DailyAvailability.create({ pitch: pitchId, date, slots });
      }
      const slot = daily.slots.find((s) => s.slotIndex === slotIndex);
      if (!slot || slot.taken) {
        skipped.push(date);
        continue;
      }
      const recurringCommission = pitch.commissionAmount || 0;
      const recurringAmount = slot.price + recurringCommission;
      const reservation = await Reservation.create({
        user: req.user._id,
        pitch: pitchId,
        slotIndex,
        slotTime: slot.time,
        date,
        playerCount: playerCount || pitch.size,
        note: note || '',
        amount: recurringAmount,
        status: 'pending',
        recurringGroupId: groupId,
      });
      // علامت‌گذاری اتمیک — جلوگیری از رزرو همزمانِ همان سانس/تاریخ
      const claim = await DailyAvailability.updateOne(
        {
          pitch: pitchId,
          date,
          slots: { $elemMatch: { slotIndex: slotIndex, taken: false } },
        },
        {
          $set: {
            'slots.$.taken': true,
            'slots.$.takenBy': req.user._id,
            'slots.$.reservationId': reservation._id,
          },
        },
      );
      if (!claim.modifiedCount) {
        // یک نفر دیگر همین لحظه این سانس را گرفت → رزرو ساخته‌شده را حذف کن
        await Reservation.deleteOne({ _id: reservation._id });
        skipped.push(date);
        continue;
      }
      created.push({
        id: reservation._id,
        date,
        time: slot.time,
        amount: recurringAmount,
      });
    }
    if (!created.length) {
      return res.status(400).json({
        success: false,
        message: 'همه سانس‌های انتخابی قبلاً رزرو شدن',
      });
    }
    res.status(201).json({
      success: true,
      groupId,
      created,
      skipped,
      totalAmount: created.reduce((sum, r) => sum + r.amount, 0),
    });
  } catch (err) {
    console.error('POST /reservations/recurring error:', err);
    res.status(500).json({ success: false, message: 'خطای سرور' });
  }
});

// ─────────────────────────────────────
// POST /api/reservations/recurring/:groupId/pay
// تأیید پرداخت گروهی — کمیسیون هر رزرو با commissionAmount فعلیِ زمین snapshot می‌شه
// ─────────────────────────────────────
router.post('/recurring/:groupId/pay', protect, async (req, res) => {
  try {
    const list = await Reservation.find({
      recurringGroupId: req.params.groupId,
      user: req.user._id,
    });
    if (!list.length)
      return res.status(404).json({ success: false, message: 'رزرو پیدا نشد' });

    // همه رزروهای یک گروه تکراری روی یک زمین هستن — یه بار pitch رو بخون
    const pitch = await Pitch.findById(list[0].pitch).select(
      'commissionAmount',
    );
    const commission = getPitchCommission(pitch);

    const txn = 'TXN-' + Date.now();
    for (const r of list) {
      if (r.status !== 'paid') {
        r.status = 'paid';
        r.payment.transactionId = txn;
        r.payment.paidAt = new Date();
        r.siteCommission = commission;
        r.pitchAmount = Math.max(0, r.amount - commission);
        await r.save();
      }
    }
    res.json({
      success: true,
      message: 'پرداخت تأیید شد 🎉',
      count: list.length,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطای سرور' });
  }
});

// ─────────────────────────────────────
// DELETE /api/reservations/recurring/:groupId
// لغو گروهی توسط خود مشتری — فقط رزروهای هنوز پرداخت‌نشده لغو می‌شن
// (پرداخت‌شده‌ها از همین مسیر دست نمی‌خورن، باید owner/admin لغوشون کنه)
// ─────────────────────────────────────
router.delete('/recurring/:groupId', protect, async (req, res) => {
  try {
    const list = await Reservation.find({
      recurringGroupId: req.params.groupId,
      user: req.user._id,
      status: { $ne: 'paid' },
    });
    for (const r of list) {
      const daily = await DailyAvailability.findOne({
        pitch: r.pitch,
        date: r.date,
      });
      if (daily) {
        const slot = daily.slots.find((s) => s.slotIndex === r.slotIndex);
        if (slot) {
          slot.taken = false;
          slot.takenBy = null;
          slot.reservationId = null;
          await daily.save();
        }
      }
      r.status = 'cancelled';
      await r.save();
    }
    res.json({ success: true, cancelled: list.length });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطای سرور' });
  }
});

// ─────────────────────────────────────
// POST /api/reservations/:id/pay  (تأیید پرداخت)
// اینجاست که کمیسیون ثابتِ همین زمین (Pitch.commissionAmount) خونده و
// روی رزرو snapshot می‌شه. خود مشتری همچنان فقط amount کامل را می‌بیند.
// ─────────────────────────────────────
router.post('/:id/pay', protect, async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id);

    if (!reservation) {
      return res.status(404).json({ success: false, message: 'رزرو پیدا نشد' });
    }
    if (reservation.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'دسترسی ندارید' });
    }
    if (reservation.status === 'paid') {
      return res
        .status(400)
        .json({ success: false, message: 'این رزرو قبلاً پرداخت شده' });
    }

    const pitch = await Pitch.findById(reservation.pitch).select(
      'commissionAmount',
    );
    const commission = getPitchCommission(pitch);

    reservation.status = 'paid';
    reservation.payment.transactionId = 'TXN-' + Date.now();
    reservation.payment.paidAt = new Date();
    reservation.siteCommission = commission;
    reservation.pitchAmount = Math.max(0, reservation.amount - commission);
    await reservation.save();

    res.json({
      success: true,
      message: 'پرداخت تأیید شد 🎉',
      code: reservation.code,
      transactionId: reservation.payment.transactionId,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطای سرور' });
  }
});

// ─────────────────────────────────────
// GET /api/reservations/my  (رزروهای خودم)
// ─────────────────────────────────────
router.get('/my', protect, async (req, res) => {
  try {
    const reservations = await Reservation.find({ user: req.user._id })
      .populate('pitch', 'name type size address')
      .sort({ createdAt: -1 });

    res.json({ success: true, reservations });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطای سرور' });
  }
});

// ─────────────────────────────────────
// DELETE /api/reservations/:id  (لغو رزرو توسط خود مشتری)
// فقط رزروهای pending قابل لغو توسط خود مشتری هستن (پرداخت‌شده‌ها رو فقط
// owner/admin می‌تونن لغو کنن، چون باید بدونن چقدرش قابل‌برگشته)
// ─────────────────────────────────────
router.delete('/:id', protect, async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id);

    if (!reservation) {
      return res.status(404).json({ success: false, message: 'رزرو پیدا نشد' });
    }
    if (reservation.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'دسترسی ندارید' });
    }
    if (reservation.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'رزرو پرداخت‌شده را نمیتوان لغو کرد',
      });
    }

    // آزاد کردن سانس فقط برای همون روز — نه برای روزهای دیگه
    const daily = await DailyAvailability.findOne({
      pitch: reservation.pitch,
      date: reservation.date,
    });

    if (daily) {
      const slot = daily.slots.find(
        (s) => s.slotIndex === reservation.slotIndex,
      );
      if (slot) {
        slot.taken = false;
        slot.takenBy = null;
        slot.reservationId = null;
        await daily.save();
      }
    }

    reservation.status = 'cancelled';
    await reservation.save();

    res.json({ success: true, message: 'رزرو لغو شد' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطای سرور' });
  }
});

// ─────────────────────────────────────
// GET /api/reservations  (ادمین — همه رزروها)
// query: ?showArchived=1 برای نمایش آرشیو هم
// ─────────────────────────────────────
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const filter = {};
    if (req.query.showArchived !== '1') {
      filter.isArchived = { $ne: true };
    }

    const reservations = await Reservation.find(filter)
      .populate('user', 'name phone')
      .populate('pitch', 'name type')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: reservations.length, reservations });
  } catch (err) {
    console.error('GET /api/reservations error:', err);
    res
      .status(500)
      .json({ success: false, message: 'خطای سرور: ' + err.message });
  }
});

module.exports = router;
