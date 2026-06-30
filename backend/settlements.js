// routes/settlements.js
// تسویه مالی بین سانس‌چی و صاحبان زمین — کمیسیون ثابت به ازای هر رزرو،
// مخصوص هر زمین (نه درصدی و نه سراسری). مقدار کمیسیون لحظه‌ی پرداخت روی
// خود رزرو snapshot می‌شه (Reservation.siteCommission / pitchAmount) و
// اینجا فقط همون مقادیر جمع زده می‌شن.

const express = require('express');
const router = express.Router();
const Settlement = require('./Settlement');
const Reservation = require('./models/Reservation');
const Pitch = require('./models/Pitch');
const { protect, adminOnly } = require('./middleware/authController');

// ─────────────────────────────────────
// POST /api/settlements/generate
// ادمین: تولید تسویه روزانه برای همه ownerها
// بدنه: { date: "1403/03/24" }
//
// شامل می‌کند:
//  - رزروهای status=paid این تاریخ → در gross/net/commission لحاظ می‌شن
//  - رزروهای status=cancelled این تاریخ که قبلاً پرداخت شده بودن (یعنی
//    siteCommission دارن) → فقط کمیسیونشون لحاظ می‌شه (غیرقابل‌برگشت)،
//    در gross/net صاحب زمین لحاظ نمی‌شن چون پولش به مشتری برگشته.
//  - رزروهایی که قبلاً در یک تسویه دیگر لحاظ شدن (settlementStatus=settled)
//    دوباره حساب نمی‌شن.
// ─────────────────────────────────────
router.post('/generate', protect, adminOnly, async (req, res) => {
  try {
    const { date } = req.body;
    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'تاریخ الزامی است (فرمت: 1403/03/24)',
      });
    }

    const candidates = await Reservation.find({
      date,
      settlementStatus: { $ne: 'settled' },
      $or: [
        { status: 'paid' },
        { status: 'cancelled', siteCommission: { $ne: null } },
      ],
    }).populate('pitch', 'owner name commissionAmount');

    if (!candidates.length) {
      return res.json({
        success: true,
        message: 'رزرو پرداختی (یا لغوشده‌ی پرداختی) برای این تاریخ پیدا نشد',
        created: [],
      });
    }

    // گروه‌بندی بر اساس owner + pitch
    const groups = {};
    for (const r of candidates) {
      if (!r.pitch || !r.pitch.owner) continue;
      const key = `${r.pitch.owner}_${r.pitch._id}`;
      if (!groups[key]) {
        groups[key] = {
          owner: r.pitch.owner,
          pitch: r.pitch._id,
          pitchName: r.pitch.name,
          reservationIds: [],
          grossAmount: 0,
          commissionAmount: 0,
          netAmount: 0,
          paidCount: 0,
          voidedCount: 0,
        };
      }
      const g = groups[key];
      // اگه به هر دلیلی siteCommission روی رزرو ثبت نشده بود (رزرو قدیمی‌تر
      // از این تغییر معماری)، با کمیسیون فعلی زمین به‌عنوان fallback حساب کن
      const commission =
        r.siteCommission != null
          ? r.siteCommission
          : r.pitch.commissionAmount || 0;
      const pitchShare =
        r.pitchAmount != null
          ? r.pitchAmount
          : Math.max(0, r.amount - commission);

      g.reservationIds.push(r._id);
      g.commissionAmount += commission;

      if (r.status === 'paid') {
        g.grossAmount += r.amount || 0;
        g.netAmount += pitchShare;
        g.paidCount++;
      } else {
        // لغوشده ولی قبلاً پرداخت شده — فقط کمیسیون لحاظ می‌شه
        g.voidedCount++;
      }
    }

    const created = [];
    const skipped = [];

    for (const key of Object.keys(groups)) {
      const g = groups[key];
      try {
        const settlement = await Settlement.findOneAndUpdate(
          { owner: g.owner, pitch: g.pitch, date },
          {
            owner: g.owner,
            pitch: g.pitch,
            date,
            reservations: g.reservationIds,
            grossAmount: g.grossAmount,
            commissionAmount: g.commissionAmount,
            netAmount: g.netAmount,
            paidCount: g.paidCount,
            voidedCount: g.voidedCount,
          },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        );

        await Reservation.updateMany(
          { _id: { $in: g.reservationIds } },
          {
            $set: {
              settlementStatus: 'settled',
              settlement: settlement._id,
              settledAt: new Date(),
            },
          },
        );

        created.push({
          id: settlement._id,
          pitchName: g.pitchName,
          grossAmount: g.grossAmount,
          commissionAmount: g.commissionAmount,
          netAmount: g.netAmount,
          paidCount: g.paidCount,
          voidedCount: g.voidedCount,
        });
      } catch (e) {
        skipped.push({ pitchName: g.pitchName, reason: e.message });
      }
    }

    res.json({
      success: true,
      message: `${created.length} تسویه تولید شد`,
      created,
      skipped,
    });
  } catch (err) {
    console.error('POST /settlements/generate error:', err);
    res
      .status(500)
      .json({ success: false, message: 'خطای سرور: ' + err.message });
  }
});

// ─────────────────────────────────────
// POST /api/settlements/request
// Owner: درخواست تسویه برای زمین‌های خودش
// بدنه: { date: "1403/03/24" }
// ─────────────────────────────────────
router.post('/request', protect, async (req, res) => {
  try {
    const { date, fromDate, toDate } = req.body;
    const start = fromDate || date;
    const end = toDate || date;

    if (!start || !end) {
      return res.status(400).json({
        success: false,
        message: 'از تاریخ و تا تاریخ الزامی است',
      });
    }

    const pitches = await Pitch.find({ owner: req.user._id });
    if (!pitches.length) {
      return res.status(400).json({
        success: false,
        message: 'شما هیچ زمینی ندارید که برای آن تسویه درخواست کنید',
      });
    }

    const pitchIds = pitches.map((p) => p._id);

    const candidates = await Reservation.find({
      pitch: { $in: pitchIds },
      date: { $gte: start, $lte: end },
      settlementStatus: { $ne: 'settled' },
      $or: [
        { status: 'paid' },
        { status: 'cancelled', siteCommission: { $ne: null } },
      ],
    }).populate('pitch', 'owner name commissionAmount');

    if (!candidates.length) {
      return res.json({
        success: true,
        message: 'رزرو پرداختی برای این بازه پیدا نشد',
        created: [],
      });
    }

    const groups = {};
    for (const r of candidates) {
      if (!r.pitch) continue;
      const key = `${r.pitch._id}_${r.date}`;
      if (!groups[key]) {
        groups[key] = {
          owner: req.user._id,
          pitch: r.pitch._id,
          date: r.date,
          pitchName: r.pitch.name,
          reservationIds: [],
          grossAmount: 0,
          commissionAmount: 0,
          netAmount: 0,
          paidCount: 0,
          voidedCount: 0,
        };
      }
      const g = groups[key];

      const commission =
        r.siteCommission != null
          ? r.siteCommission
          : r.pitch.commissionAmount || 0;
      const pitchShare =
        r.pitchAmount != null
          ? r.pitchAmount
          : Math.max(0, r.amount - commission);

      g.reservationIds.push(r._id);
      g.commissionAmount += commission;

      if (r.status === 'paid') {
        g.grossAmount += r.amount || 0;
        g.netAmount += pitchShare;
        g.paidCount++;
      } else {
        g.voidedCount++;
      }
    }

    const created = [];
    const skipped = [];

    for (const key of Object.keys(groups)) {
      const g = groups[key];
      try {
        const settlement = await Settlement.findOneAndUpdate(
          { owner: g.owner, pitch: g.pitch, date: g.date },
          {
            owner: g.owner,
            pitch: g.pitch,
            date: g.date,
            reservations: g.reservationIds,
            grossAmount: g.grossAmount,
            commissionAmount: g.commissionAmount,
            netAmount: g.netAmount,
            paidCount: g.paidCount,
            voidedCount: g.voidedCount,
            status: 'pending',
          },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        );

        await Reservation.updateMany(
          { _id: { $in: g.reservationIds } },
          {
            $set: {
              settlementStatus: 'settled',
              settlement: settlement._id,
              settledAt: new Date(),
            },
          },
        );

        created.push({
          id: settlement._id,
          date: g.date,
          pitchName: g.pitchName,
          grossAmount: g.grossAmount,
          commissionAmount: g.commissionAmount,
          netAmount: g.netAmount,
          paidCount: g.paidCount,
          voidedCount: g.voidedCount,
        });
      } catch (e) {
        skipped.push({ pitchName: g.pitchName, reason: e.message });
      }
    }

    res.json({
      success: true,
      message: `${created.length} درخواست تسویه ثبت شد`,
      created,
      skipped,
      range: { fromDate: start, toDate: end },
    });
  } catch (err) {
    console.error('POST /settlements/request error:', err);
    res
      .status(500)
      .json({ success: false, message: 'خطای سرور: ' + err.message });
  }
});

// ─────────────────────────────────────
// GET /api/settlements  (ادمین: همه تسویه‌ها)
// query: ?status=pending&date=1403/03/24&ownerId=xxx&pitchId=xxx
// ─────────────────────────────────────
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.date) filter.date = req.query.date;
    if (req.query.ownerId) filter.owner = req.query.ownerId;
    if (req.query.pitchId) filter.pitch = req.query.pitchId;

    const settlements = await Settlement.find(filter)
      .populate('owner', 'name phone')
      .populate('pitch', 'name type')
      .populate('approvedBy', 'name')
      .sort({ date: -1, createdAt: -1 });

    const stats = {
      totalGross: settlements.reduce((s, t) => s + t.grossAmount, 0),
      totalCommission: settlements.reduce((s, t) => s + t.commissionAmount, 0),
      totalNet: settlements.reduce((s, t) => s + t.netAmount, 0),
      pending: settlements.filter((t) => t.status === 'pending').length,
      approved: settlements.filter((t) => t.status === 'approved').length,
      paid: settlements.filter((t) => t.status === 'paid').length,
    };

    res.json({ success: true, count: settlements.length, settlements, stats });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطای سرور' });
  }
});

// ─────────────────────────────────────
// GET /api/settlements/my  (owner: تسویه‌های خودم)
// ─────────────────────────────────────
router.get('/my', protect, async (req, res) => {
  try {
    const filter = { owner: req.user._id };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.date) filter.date = req.query.date;

    const settlements = await Settlement.find(filter)
      .populate('pitch', 'name type')
      .populate(
        'reservations',
        'slotTime amount date code status siteCommission pitchAmount',
      )
      .sort({ date: -1, createdAt: -1 });

    const stats = {
      totalGross: settlements.reduce((s, t) => s + t.grossAmount, 0),
      totalCommission: settlements.reduce((s, t) => s + t.commissionAmount, 0),
      totalNet: settlements.reduce((s, t) => s + t.netAmount, 0),
      pending: settlements.filter((t) => t.status === 'pending').length,
      paid: settlements.filter((t) => t.status === 'paid').length,
    };

    res.json({ success: true, count: settlements.length, settlements, stats });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطای سرور' });
  }
});

// ─────────────────────────────────────
// PATCH /api/settlements/:id/approve  (ادمین)
// ─────────────────────────────────────
router.patch('/:id/approve', protect, adminOnly, async (req, res) => {
  try {
    const { adminNote } = req.body;
    const settlement = await Settlement.findById(req.params.id);
    if (!settlement) {
      return res
        .status(404)
        .json({ success: false, message: 'تسویه پیدا نشد' });
    }
    if (settlement.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'فقط تسویه‌های در انتظار قابل تأیید است',
      });
    }

    settlement.status = 'approved';
    settlement.approvedAt = new Date();
    settlement.approvedBy = req.user._id;
    if (adminNote) settlement.adminNote = adminNote;
    await settlement.save();

    res.json({ success: true, settlement });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطای سرور' });
  }
});

// ─────────────────────────────────────
// PATCH /api/settlements/:id/pay  (ادمین: اعلام پرداخت)
// ─────────────────────────────────────
router.patch('/:id/pay', protect, adminOnly, async (req, res) => {
  try {
    const { adminNote } = req.body;
    const settlement = await Settlement.findById(req.params.id);
    if (!settlement) {
      return res
        .status(404)
        .json({ success: false, message: 'تسویه پیدا نشد' });
    }
    if (!['pending', 'approved'].includes(settlement.status)) {
      return res.status(400).json({
        success: false,
        message: 'این تسویه قبلاً پرداخت یا رد شده',
      });
    }

    settlement.status = 'paid';
    settlement.paidAt = new Date();
    if (!settlement.approvedAt) {
      settlement.approvedAt = new Date();
      settlement.approvedBy = req.user._id;
    }
    if (adminNote) settlement.adminNote = adminNote;
    await settlement.save();

    res.json({ success: true, settlement });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطای سرور' });
  }
});

// ─────────────────────────────────────
// PATCH /api/settlements/:id/reject  (ادمین)
// رد کردن تسویه → رزروهای مرتبط آزاد می‌شن تا بشه دوباره تولیدش کرد
// ─────────────────────────────────────
router.patch('/:id/reject', protect, adminOnly, async (req, res) => {
  try {
    const { adminNote } = req.body;
    const settlement = await Settlement.findById(req.params.id);
    if (!settlement) {
      return res
        .status(404)
        .json({ success: false, message: 'تسویه پیدا نشد' });
    }
    if (settlement.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'تسویه پرداخت‌شده قابل رد نیست',
      });
    }

    settlement.status = 'rejected';
    if (adminNote) settlement.adminNote = adminNote;
    await settlement.save();

    await Reservation.updateMany(
      { _id: { $in: settlement.reservations } },
      { $set: { settlementStatus: 'none', settlement: null, settledAt: null } },
    );

    res.json({ success: true, settlement });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطای سرور' });
  }
});

// ─────────────────────────────────────
// GET /api/settlements/summary  (ادمین: خلاصه کل کمیسیون سانس‌چی)
// ─────────────────────────────────────
router.get('/summary', protect, adminOnly, async (req, res) => {
  try {
    const all = await Settlement.find({});

    const byStatus = {
      pending: { count: 0, gross: 0, commission: 0, net: 0 },
      approved: { count: 0, gross: 0, commission: 0, net: 0 },
      paid: { count: 0, gross: 0, commission: 0, net: 0 },
      rejected: { count: 0, gross: 0, commission: 0, net: 0 },
    };

    for (const s of all) {
      const st = byStatus[s.status] || byStatus.pending;
      st.count++;
      st.gross += s.grossAmount;
      st.commission += s.commissionAmount;
      st.net += s.netAmount;
    }

    res.json({
      success: true,
      byStatus,
      totals: {
        count: all.length,
        gross: all.reduce((s, t) => s + t.grossAmount, 0),
        commission: all.reduce((s, t) => s + t.commissionAmount, 0),
        net: all.reduce((s, t) => s + t.netAmount, 0),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطای سرور' });
  }
});

module.exports = router;
