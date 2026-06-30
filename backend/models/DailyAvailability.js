const mongoose = require('mongoose');

const dailySlotSchema = new mongoose.Schema(
  {
    slotIndex: { type: Number, required: true },
    time: { type: String, required: true },
    price: { type: Number, required: true }, // قیمت واقعی مالک
    commission: { type: Number, default: 0 }, // کمیسیون ثابت سایت
    sitePrice: { type: Number, default: 0 }, // price + commission (قیمت کاربر)
    taken: { type: Boolean, default: false },
    takenBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reservationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Reservation',
      default: null,
    },
  },
  { _id: false },
);

const dailyAvailabilitySchema = new mongoose.Schema({
  pitch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pitch',
    required: true,
  },
  date: {
    type: String,
    required: true,
  },
  slots: [dailySlotSchema],
  createdAt: { type: Date, default: Date.now },
});

dailyAvailabilitySchema.index({ pitch: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DailyAvailability', dailyAvailabilitySchema);
