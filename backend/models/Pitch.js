const mongoose = require('mongoose');

const slotSchema = new mongoose.Schema(
  {
    time: { type: String, required: true }, // مثلاً "۱۸:۰۰–۱۹:۰۰"
    price: { type: Number, required: true, default: 550000 }, // قیمت اختصاصی این سانس
    taken: { type: Boolean, default: false },
    takenBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { _id: false },
);

const pitchSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: ['futsal', 'grass'], required: true },
  size: { type: Number, enum: [5, 7, 11], required: true },
  price: { type: Number, required: true }, // قیمت پایه (نمایشی روی کارت)
  address: { type: String, required: true },
  desc: { type: String },
  tags: [String],
  color1: { type: String, default: '#0d3320' },
  color2: { type: String, default: '#051a0e' },
  image: { type: String, default: '' }, // عکس زمین (base64 data-url)
  isActive: { type: Boolean, default: true },

  // ── کمیسیون سانس‌چی ──
  // مبلغ ثابت (تومان) که سانس‌چی به ازای هر رزروی که از این زمین پرداخت
  // می‌شه برمی‌داره. فقط ادمین این رو تنظیم می‌کنه؛ صاحب زمین فقط می‌بینه.
  // این مبلغ هیچ‌وقت روی صفحات مشتری (reserve/payment) نمایش داده نمی‌شه؛
  // مشتری همیشه همون قیمت کامل سانس رو پرداخت می‌کنه.
  commissionAmount: { type: Number, default: 0, min: 0 },

  // ── صاحب زمین ──
  // اگه null باشه یعنی این زمین به هیچ حسابی متصل نیست (فقط ادمین مدیریتش می‌کنه)
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  // سانس‌های روزانه — هر سانس قیمت اختصاصی خودش رو دارد
  slots: {
    type: [slotSchema],
    default: () => [
      { time: '۰۶:۰۰–۰۷:۳۰', price: 550000, taken: false },
      { time: '۰۷:۳۰–۰۹:۰۰', price: 550000, taken: false },
      { time: '۰۹:۰۰–۱۰:۳۰', price: 550000, taken: false },
      { time: '۱۰:۳۰–۱۲:۰۰', price: 550000, taken: false },
      { time: '۱۲:۰۰–۱۳:۳۰', price: 550000, taken: false },
      { time: '۱۳:۳۰–۱۵:۰۰', price: 550000, taken: false },
      { time: '۱۵:۰۰–۱۶:۳۰', price: 550000, taken: false },
      { time: '۱۶:۳۰–۱۸:۰۰', price: 700000, taken: false },
      { time: '۱۸:۰۰–۱۹:۳۰', price: 700000, taken: false },
      { time: '۱۹:۳۰–۲۱:۰۰', price: 700000, taken: false },
      { time: '۲۱:۰۰–۲۲:۳۰', price: 700000, taken: false },
    ],
  },

  createdAt: { type: Date, default: Date.now },
});

// تعداد سانس‌های خالی (virtual)
pitchSchema.virtual('availCount').get(function () {
  return (this.slots || []).filter((s) => !s.taken).length;
});

pitchSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Pitch', pitchSchema);
