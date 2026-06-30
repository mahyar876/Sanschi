const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  pitch: { type: mongoose.Schema.Types.ObjectId, ref: 'Pitch', required: true },
  slotIndex: { type: Number, required: true },
  slotTime: { type: String, required: true }, // "۱۸:۰۰–۱۹:۰۰"
  date: { type: String, required: true }, // "1403/03/24"
  playerCount: { type: Number, default: 5 },
  note: { type: String, default: '' },
  amount: { type: Number, required: true }, // تومان — مبلغ کامل که مشتری پرداخت می‌کند (بدون تغییر، برای فرانت)

  status: {
    type: String,
    enum: ['pending', 'paid', 'cancelled'],
    default: 'pending',
  },

  // ── کمیسیون سانس‌چی (snapshot لحظه‌ی تأیید پرداخت) ──
  // این دو فیلد فقط وقتی status به paid تغییر می‌کند پر می‌شوند و با
  // commissionAmount فعلیِ زمین (در آن لحظه) محاسبه می‌شوند. تغییر بعدیِ
  // کمیسیون زمین، رزروهای قبلاً پرداخت‌شده را تغییر نمی‌دهد.
  // siteCommission = سهم ثابت سانس‌چی (تومان) — در صورت لغو هم باقی می‌ماند
  //   و غیرقابل‌برگشت است.
  // pitchAmount    = amount - siteCommission = سهم صاحب زمین، تنها مبلغی
  //   که در صورت لغو رزرو پرداخت‌شده باید به مشتری برگردانده شود.
  siteCommission: { type: Number, default: null },
  pitchAmount: { type: Number, default: null },

  // ── ردیابی تسویه ──
  settlementStatus: {
    type: String,
    enum: ['none', 'settled'],
    default: 'none',
  },
  settlement: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Settlement',
    default: null,
  },
  settledAt: { type: Date, default: null },

  // ── لغو بعد از پرداخت ──
  voidedAt: { type: Date, default: null },
  voidReason: { type: String, default: '' },

  // کد رزرو یکتا
  recurringGroupId: { type: String, default: null },
  code: {
    type: String,
    unique: true,
    default: () =>
      'SNS-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
  },

  // اطلاعات پرداخت (mock)
  payment: {
    transactionId: String,
    paidAt: Date,
    method: { type: String, default: 'card' },
    // ── زرین‌پال ──
    // authority: شناسه تراکنش زرین‌پال؛ هنگام ساخت درخواست ذخیره می‌شود
    //   تا callback (که JWT ندارد) بتواند رزرو را پیدا کند — جایگزین
    //   نگهداری در حافظه، مقاوم در برابر ری‌استارت سرور.
    // gatewayAmount: مبلغ دقیقی که به درگاه ارسال شد (برای verify لازم است).
    authority: { type: String, default: null, index: true },
    gatewayAmount: { type: Number, default: null },
  },

  createdAt: { type: Date, default: Date.now },

  // آرشیو — رزرو از تاریخچه پنهان می‌شه ولی در درآمد حساب می‌شه
  isArchived: { type: Boolean, default: false },
  archivedAt: { type: Date, default: null },
});

module.exports = mongoose.model('Reservation', reservationSchema);
