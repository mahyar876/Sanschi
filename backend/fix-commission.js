const mongoose = require('mongoose');
const Pitch = require('./models/Pitch');

// آدرس دیتابیس خودتو اینجا بذار
const MONGO_URI = process.env.MONGO_URI || 'http://localhost:5000/api';

async function fix() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to DB');

    const pitches = await Pitch.find({});
    let updated = 0;

    for (const pitch of pitches) {
      if (!pitch.slots || !pitch.slots.length) continue;

      // چک کن ببین کدوم سانس‌ها commission ندارن
      const changed = pitch.slots.map((slot) => ({
        ...slot.toObject(),
        // مثلاً همه سانس‌ها ۵۰ هزار تومان کمیسیون داشته باشن
        // ← اینجا هر مقدار خواستی بذار:
        commission: slot.commission !== undefined ? slot.commission : 50000,
      }));

      // فقط اگه تغییری ایجاد شد ذخیره کن
      pitch.slots = changed;
      await pitch.save();
      updated++;
    }

    console.log(`🎉 ${updated}_pitch(ها) آپدیت شدن با commission`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

fix();
