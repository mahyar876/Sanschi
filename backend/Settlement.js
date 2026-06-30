const mongoose = require('mongoose');

const settlementSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  pitch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pitch',
    required: true,
  },
  // تاریخ شمسی تسویه — مثلاً "1403/03/24"
  date: { type: String, required: true },

  // رزروهای شامل این تسویه (هم پرداختی فعال و هم لغوشده‌ی پرداختی)
  reservations: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Reservation',
    },
  ],

  // ── مبالغ ──
  // grossAmount / netAmount فقط بر اساس رزروهایی محاسبه می‌شن که الان هم
  // status=paid هستن (یعنی لغو نشدن) — چون اگه لغو شده باشن سهم صاحب زمین
  // به مشتری برگشته و owner چیزی دریافت نمی‌کند.
  grossAmount: { type: Number, required: true }, // جمع amount رزروهای فعال
  commissionAmount: { type: Number, required: true }, // جمع کمیسیون ثابت — شامل رزروهای لغوشده‌ی پرداختی هم می‌شود (غیرقابل‌برگشت)
  netAmount: { type: Number, required: true }, // سهم صاحب زمین از رزروهای فعال (gross - کمیسیون رزروهای فعال)

  // تعداد رزرو فعال / لغوشده‌ی پرداختی که در این تسویه لحاظ شدن (نمایشی)
  paidCount: { type: Number, default: 0 },
  voidedCount: { type: Number, default: 0 },

  status: {
    type: String,
    enum: ['pending', 'approved', 'paid', 'rejected'],
    default: 'pending',
  },

  // یادداشت ادمین
  adminNote: { type: String, default: '' },

  // تاریخ تأیید و پرداخت
  approvedAt: { type: Date },
  paidAt: { type: Date },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  createdAt: { type: Date, default: Date.now },
});

// هر owner در هر روز و هر زمین فقط یه تسویه
settlementSchema.index({ owner: 1, pitch: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Settlement', settlementSchema);
