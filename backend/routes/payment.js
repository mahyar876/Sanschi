// routes/payment.js
// ════════════════════════════════════════════════════════════════
//  درگاه پرداخت زرین‌پال — سانس‌چی
//  جریان:
//   1) فرانت  →  POST /api/payment/zarinpal/request   (با JWT)
//        بک‌اند تراکنش رو نزد زرین‌پال می‌سازد، authority را روی خود
//        رزرو(ها) در دیتابیس ذخیره می‌کند و آدرس درگاه (StartPay) را
//        برمی‌گرداند؛ فرانت کاربر را به آن آدرس ریدایرکت می‌کند.
//   2) کاربر در درگاه پرداخت می‌کند و زرین‌پال او را به
//        GET /api/payment/zarinpal/callback?Authority=..&Status=OK برمی‌گرداند.
//   3) بک‌اند تراکنش را verify می‌کند، رزرو(ها) را با همان authority پیدا و
//        paid می‌کند و کاربر را به صفحه payment.html با نتیجه ریدایرکت می‌کند.
//
//  نکته: authority روی خود رزرو در دیتابیس ذخیره می‌شود (نه در حافظه)،
//        پس ری‌استارت سرور مشکلی ایجاد نمی‌کند. returnQuery هم داخل
//        خود callback_url کدگذاری می‌شود.
//
//  ── تنظیمات .env لازم ──
//   ZARINPAL_MERCHANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
//   ZARINPAL_SANDBOX=true            # برای تست؛ در production = false
//   ZARINPAL_CURRENCY=rial           # rial یا toman (قیمت سایت تومان است)
//   BASE_URL=http://localhost:5000   # آدرس خود بک‌اند (برای callback)
//   FRONTEND_URL=http://localhost:5000   # آدرس فرانت (برای ریدایرکت نهایی)
// ════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const Reservation = require('../models/Reservation');
const Pitch = require('../models/Pitch');
const { protect } = require('../middleware/authController');

// ── تنظیمات ──
const MERCHANT_ID = process.env.ZARINPAL_MERCHANT_ID || '';
const SANDBOX = String(process.env.ZARINPAL_SANDBOX || 'true') === 'true';
const CURRENCY = (process.env.ZARINPAL_CURRENCY || 'rial').toLowerCase();
const BASE_URL = (process.env.BASE_URL || 'http://localhost:5000').replace(
  /\/$/,
  '',
);
const FRONTEND_URL = (
  process.env.FRONTEND_URL || 'http://localhost:5000'
).replace(/\/$/, '');

const ZP_BASE = SANDBOX
  ? 'https://sandbox.zarinpal.com'
  : 'https://api.zarinpal.com';
const ZP_REQUEST = `${ZP_BASE}/pg/v4/payment/request.json`;
const ZP_VERIFY = `${ZP_BASE}/pg/v4/payment/verify.json`;
const ZP_STARTPAY = (authority) =>
  `${SANDBOX ? 'https://sandbox.zarinpal.com' : 'https://www.zarinpal.com'}/pg/StartPay/${authority}`;

// قیمت‌های سایت به تومان است؛ زرین‌پال (v4) معمولاً ریال می‌خواهد.
function toGatewayAmount(toman) {
  return CURRENCY === 'toman' ? toman : toman * 10;
}

// کمیسیون ثابت زمین
function getPitchCommission(pitch) {
  return (pitch && pitch.commissionAmount) || 0;
}

// ════════════════════════════════════════════════════════════════
// POST /api/payment/zarinpal/request   🔒
// body: { reservationId?, recurringGroupId?, amount, discount?, returnQuery? }
// ════════════════════════════════════════════════════════════════
router.post('/zarinpal/request', protect, async (req, res) => {
  try {
    if (!MERCHANT_ID) {
      return res.status(500).json({
        success: false,
        message: 'مرچنت زرین‌پال تنظیم نشده (ZARINPAL_MERCHANT_ID)',
      });
    }

    const { reservationId, recurringGroupId, amount, returnQuery } = req.body;

    const finalToman = parseInt(amount);
    if (!finalToman || finalToman < 1000) {
      return res
        .status(400)
        .json({ success: false, message: 'مبلغ نامعتبر است' });
    }

    // ── پیدا کردن رزرو(های) مربوطه و بررسی مالکیت ──
    let reservations = [];
    if (recurringGroupId) {
      reservations = await Reservation.find({
        recurringGroupId,
        user: req.user._id,
      });
    } else if (reservationId && !String(reservationId).startsWith('mock')) {
      const r = await Reservation.findById(reservationId);
      if (r) reservations = [r];
    }

    if (!reservations.length) {
      return res.status(404).json({
        success: false,
        message: 'رزرو معتبری برای پرداخت پیدا نشد',
      });
    }
    // اطمینان از مالکیت
    if (
      reservations.some((r) => r.user.toString() !== req.user._id.toString())
    ) {
      return res.status(403).json({ success: false, message: 'دسترسی ندارید' });
    }
    if (reservations.every((r) => r.status === 'paid')) {
      return res
        .status(400)
        .json({ success: false, message: 'این رزرو قبلاً پرداخت شده است' });
    }

    const gatewayAmount = toGatewayAmount(finalToman);
    // returnQuery داخل خود callback_url کدگذاری می‌شود تا پارامترهای رزرو
    // پس از بازگشت از درگاه حفظ شوند.
    const callbackUrl =
      `${BASE_URL}/api/payment/zarinpal/callback` +
      `?rq=${encodeURIComponent(returnQuery || '')}`;

    // ── درخواست به زرین‌پال ──
    const zpRes = await fetch(ZP_REQUEST, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        merchant_id: MERCHANT_ID,
        amount: gatewayAmount,
        callback_url: callbackUrl,
        description: 'پرداخت رزرو سانس‌چی',
        metadata: { mobile: req.user.phone || '' },
      }),
    });
    const zpData = await zpRes.json();

    if (!zpData.data || zpData.data.code !== 100 || !zpData.data.authority) {
      const errMsg =
        (zpData.errors &&
          (zpData.errors.message || JSON.stringify(zpData.errors))) ||
        'خطا در ساخت تراکنش زرین‌پال';
      return res.status(400).json({ success: false, message: errMsg });
    }

    const authority = zpData.data.authority;

    // ── ذخیره authority روی همه رزروهای این پرداخت (مقاوم به ری‌استارت) ──
    await Reservation.updateMany(
      { _id: { $in: reservations.map((r) => r._id) } },
      {
        $set: {
          'payment.authority': authority,
          'payment.gatewayAmount': gatewayAmount,
        },
      },
    );

    return res.json({
      success: true,
      authority,
      url: ZP_STARTPAY(authority), // ← فرانت به این آدرس ریدایرکت می‌کند
    });
  } catch (err) {
    console.error('zarinpal/request error:', err);
    res
      .status(500)
      .json({ success: false, message: 'خطای سرور در اتصال به درگاه' });
  }
});

// ════════════════════════════════════════════════════════════════
// GET /api/payment/zarinpal/callback?rq=..&Authority=..&Status=..
// زرین‌پال کاربر را به اینجا برمی‌گرداند (بدون JWT).
// ════════════════════════════════════════════════════════════════
router.get('/zarinpal/callback', async (req, res) => {
  const { Authority, Status, rq } = req.query;

  // آدرس بازگشت به فرانت (با حفظ پارامترهای رزرو اصلی که در rq آمده‌اند)
  const buildRedirect = (extra) => {
    const base = `${FRONTEND_URL}/pages/payment.html`;
    let q = rq || '';
    if (q && !q.startsWith('?')) q = '?' + q;
    const sep = q ? '&' : '?';
    return base + q + sep + extra;
  };

  // پیدا کردن رزروهای متصل به این authority
  let reservations = [];
  if (Authority) {
    reservations = await Reservation.find({ 'payment.authority': Authority });
  }

  // کاربر پرداخت را لغو کرد یا authority نامعتبر است
  if (Status !== 'OK' || !reservations.length) {
    return res.redirect(buildRedirect('payResult=failed'));
  }

  try {
    const gatewayAmount =
      reservations[0].payment.gatewayAmount ||
      reservations.reduce((s, r) => s + toGatewayAmount(r.amount), 0);

    // ── verify ──
    const vRes = await fetch(ZP_VERIFY, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        merchant_id: MERCHANT_ID,
        amount: gatewayAmount,
        authority: Authority,
      }),
    });
    const vData = await vRes.json();

    // code 100 = موفق، 101 = قبلاً verify شده
    const okCode =
      vData.data && (vData.data.code === 100 || vData.data.code === 101);
    if (!okCode) {
      return res.redirect(buildRedirect('payResult=failed'));
    }

    const refId = vData.data.ref_id || '';

    // ── علامت‌گذاری رزرو(ها) به‌عنوان paid (همان منطق /reservations/pay) ──
    // کمیسیون هر رزرو از روی زمین خودش snapshot می‌شود.
    const pitchCache = {};
    for (const r of reservations) {
      if (r.status === 'paid') continue;
      const pid = r.pitch.toString();
      if (!(pid in pitchCache)) {
        const pitch = await Pitch.findById(r.pitch).select('commissionAmount');
        pitchCache[pid] = getPitchCommission(pitch);
      }
      const commission = pitchCache[pid];
      r.status = 'paid';
      r.payment.transactionId = 'ZP-' + refId;
      r.payment.method = 'zarinpal';
      r.payment.paidAt = new Date();
      r.siteCommission = commission;
      r.pitchAmount = Math.max(0, r.amount - commission);
      await r.save();
    }

    const code = reservations[0].code || '';
    return res.redirect(
      buildRedirect(
        `payResult=success&refId=${encodeURIComponent(refId)}&code=${encodeURIComponent(code)}`,
      ),
    );
  } catch (err) {
    console.error('zarinpal/callback error:', err);
    return res.redirect(buildRedirect('payResult=failed'));
  }
});

module.exports = router;
