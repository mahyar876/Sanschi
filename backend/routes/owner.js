const express = require('express');
const router = express.Router();
const Pitch = require('../models/Pitch');
const Reservation = require('../models/Reservation');
const DailyAvailability = require('../models/DailyAvailability');
const { protect } = require('../middleware/authController');

async function loadOwnedPitch(req, res, next) {
  try {
    const pitch = await Pitch.findById(req.params.id);
    if (!pitch) {
      return res.status(404).json({ success: false, message: 'زمین پیدا نشد' });
    }
    const isOwner =
      pitch.owner && pitch.owner.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res
        .status(403)
        .json({ success: false, message: 'این زمین به حساب شما متصل نیست' });
    }
    req.pitch = pitch;
    next();
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطای سرور' });
  }
}

router.get('/pitches', protect, async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { owner: req.user._id };
    const pitches = await Pitch.find(filter).sort({ createdAt: -1 });

    const data = pitches.map((p) => ({
      ...p.toJSON(),
      avail: p.slots.filter((s) => !s.taken).length,
    }));

    res.json({ success: true, pitches: data });
  } catch (err) {
    console.error('GET /owner/pitches error:', err);
    res.status(500).json({ success: false, message: 'خطای سرور' });
  }
});

router.patch('/pitches/:id', protect, loadOwnedPitch, async (req, res) => {
  try {
    const allowed = [
      'name',
      'type',
      'size',
      'price',
      'address',
      'desc',
      'tags',
      'color1',
      'color2',
      'image',
      'isActive',
      'slots',
      'commissionAmount',
    ];
    allowed.forEach((key) => {
      if (req.body[key] !== undefined) req.pitch[key] = req.body[key];
    });

    await req.pitch.save();
    res.json({ success: true, pitch: req.pitch });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const msg = Object.values(err.errors)
        .map((e) => e.message)
        .join(' | ');
      return res.status(400).json({ success: false, message: msg });
    }
    res.status(400).json({ success: false, message: err.message });
  }
});

router.get(
  '/pitches/:id/reservations',
  protect,
  loadOwnedPitch,
  async (req, res) => {
    try {
      const filter = { pitch: req.pitch._id };
      // پیش‌فرض: آرشیوشده‌ها نشون داده نمی‌شن مگه با ?showArchived=1
      if (req.query.showArchived !== '1') {
        filter.isArchived = { $ne: true };
      }
      const reservations = await Reservation.find(filter)
        .populate('user', 'name phone')
        .sort({ createdAt: -1 });
      res.json({ success: true, reservations });
    } catch (err) {
      res.status(500).json({ success: false, message: 'خطای سرور' });
    }
  },
);

// ─────────────────────────────────────
// PATCH /api/owner/reservations/:id/status
// تایید پرداخت یا لغو یک رزرو — فقط اگه زمینش مال خودش باشه
// لغو → آزاد کردن سانس واقعی همون تاریخ (DailyAvailability)
// ─────────────────────────────────────
router.patch('/reservations/:id/status', protect, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['paid', 'cancelled'].includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: 'وضعیت نامعتبر است' });
    }

    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) {
      return res.status(404).json({ success: false, message: 'رزرو پیدا نشد' });
    }

    const pitch = await Pitch.findById(reservation.pitch);
    if (!pitch) {
      return res.status(404).json({ success: false, message: 'زمین پیدا نشد' });
    }

    const isOwner =
      pitch.owner && pitch.owner.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res
        .status(403)
        .json({ success: false, message: 'این رزرو به زمین شما تعلق ندارد' });
    }

    if (status === 'cancelled') {
      if (reservation.status === 'cancelled') {
        return res
          .status(400)
          .json({ success: false, message: 'این رزرو قبلاً لغو شده' });
      }
      // آزاد کردن سانس واقعی همون تاریخ خاص — نه فقط الگوی زمین
      const daily = await DailyAvailability.findOne({
        pitch: pitch._id,
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
    } else if (status === 'paid') {
      reservation.status = 'paid';
      reservation.payment = reservation.payment || {};
      if (!reservation.payment.transactionId) {
        reservation.payment.transactionId = 'OWNER-CONFIRM-' + Date.now();
      }
      if (!reservation.payment.paidAt) {
        reservation.payment.paidAt = new Date();
      }
      // snapshot کمیسیون ثابت زمین در لحظه‌ی تأیید پرداخت (اگر قبلاً ثبت نشده)
      // تا تسویه‌ی مالی این رزرو هم درست محاسبه شود.
      if (reservation.siteCommission == null) {
        const commission = pitch.commissionAmount || 0;
        reservation.siteCommission = commission;
        reservation.pitchAmount = Math.max(0, reservation.amount - commission);
      }
    }

    await reservation.save();
    res.json({ success: true, reservation });
  } catch (err) {
    console.error('PATCH /owner/reservations/:id/status error:', err);
    res.status(500).json({ success: false, message: 'خطای سرور' });
  }
});

// ─────────────────────────────────────
// DELETE /api/owner/reservations/group/:groupId
// لغو گروهی رزروهای تکراری — owner یا admin می‌تونن
// ─────────────────────────────────────
router.delete('/reservations/group/:groupId', protect, async (req, res) => {
  try {
    const list = await Reservation.find({
      recurringGroupId: req.params.groupId,
      status: { $ne: 'cancelled' },
    });

    if (!list.length) {
      return res
        .status(404)
        .json({ success: false, message: 'رزروی پیدا نشد' });
    }

    // چک مالکیت — همه رزروها باید به زمین این owner تعلق داشته باشن
    const pitch = await Pitch.findById(list[0].pitch);
    if (!pitch) {
      return res.status(404).json({ success: false, message: 'زمین پیدا نشد' });
    }
    const isOwner =
      pitch.owner && pitch.owner.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'دسترسی ندارید' });
    }

    let cancelled = 0;
    for (const r of list) {
      // آزاد کردن سانس در DailyAvailability
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
      cancelled++;
    }

    res.json({ success: true, cancelled });
  } catch (err) {
    console.error('DELETE /owner/reservations/group error:', err);
    res.status(500).json({ success: false, message: 'خطای سرور' });
  }
});

// ─────────────────────────────────────
// DELETE /api/owner/reservations/:id
// لغو یک رزرو منفرد توسط owner
// ─────────────────────────────────────
router.delete('/reservations/:id', protect, async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) {
      return res.status(404).json({ success: false, message: 'رزرو پیدا نشد' });
    }
    if (reservation.status === 'cancelled') {
      return res
        .status(400)
        .json({ success: false, message: 'این رزرو قبلاً لغو شده' });
    }

    const pitch = await Pitch.findById(reservation.pitch);
    if (!pitch) {
      return res.status(404).json({ success: false, message: 'زمین پیدا نشد' });
    }
    const isOwner =
      pitch.owner && pitch.owner.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'دسترسی ندارید' });
    }

    // آزاد کردن سانس
    const daily = await DailyAvailability.findOne({
      pitch: pitch._id,
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
    res.json({ success: true, reservation });
  } catch (err) {
    console.error('DELETE /owner/reservations/:id error:', err);
    res.status(500).json({ success: false, message: 'خطای سرور' });
  }
});

// ─────────────────────────────────────
// PATCH /api/owner/reservations/:id/archive
// آرشیو یک رزرو — از تاریخچه پنهان می‌شه، درآمد باقیه
// ─────────────────────────────────────
router.patch('/reservations/:id/archive', protect, async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) {
      return res.status(404).json({ success: false, message: 'رزرو پیدا نشد' });
    }

    const pitch = await Pitch.findById(reservation.pitch);
    if (!pitch) {
      return res.status(404).json({ success: false, message: 'زمین پیدا نشد' });
    }

    const isOwner =
      pitch.owner && pitch.owner.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'دسترسی ندارید' });
    }

    reservation.isArchived = !reservation.isArchived;
    reservation.archivedAt = reservation.isArchived ? new Date() : null;
    await reservation.save();

    res.json({
      success: true,
      archived: reservation.isArchived,
      reservation,
    });
  } catch (err) {
    console.error('PATCH /owner/reservations/:id/archive error:', err);
    res.status(500).json({ success: false, message: 'خطای سرور' });
  }
});

// ─────────────────────────────────────
// PATCH /api/owner/reservations/bulk-archive
// آرشیو دسته‌جمعی — آرشیو همه رزروهای فیلترشده
// body: { pitchId?, status?, olderThanDays? }
// ─────────────────────────────────────
router.patch('/reservations/bulk-archive', protect, async (req, res) => {
  try {
    const { pitchId, status, olderThanDays } = req.body;

    // ساخت فیلتر
    const filter = { isArchived: false };

    if (pitchId) {
      // بررسی مالکیت
      const pitch = await Pitch.findById(pitchId);
      if (!pitch) {
        return res
          .status(404)
          .json({ success: false, message: 'زمین پیدا نشد' });
      }
      const isOwner =
        pitch.owner && pitch.owner.toString() === req.user._id.toString();
      const isAdmin = req.user.role === 'admin';
      if (!isOwner && !isAdmin) {
        return res
          .status(403)
          .json({ success: false, message: 'دسترسی ندارید' });
      }
      filter.pitch = pitchId;
    } else if (req.user.role !== 'admin') {
      // اگه pitchId ندادن، فقط ادمین می‌تونه bulk کنه
      return res.status(403).json({ success: false, message: 'دسترسی ندارید' });
    }

    if (status) filter.status = status;
    if (olderThanDays) {
      filter.createdAt = {
        $lt: new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000),
      };
    }

    const result = await Reservation.updateMany(filter, {
      $set: { isArchived: true, archivedAt: new Date() },
    });

    res.json({ success: true, archived: result.modifiedCount });
  } catch (err) {
    console.error('PATCH /owner/reservations/bulk-archive error:', err);
    res.status(500).json({ success: false, message: 'خطای سرور' });
  }
});

module.exports = router;
