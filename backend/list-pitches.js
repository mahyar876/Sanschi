// list-pitches.js
// اجرا: node list-pitches.js
// لیست همه زمین‌ها رو با آیدی‌شون چاپ می‌کنه — برای کپی کردن تو assign-owner.js

const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();
const Pitch = require('./models/Pitch');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  const pitches = await Pitch.find().select('name type size owner');
  if (!pitches.length) {
    console.log('هیچ زمینی تو دیتابیس نیست.');
  } else {
    console.log('');
    pitches.forEach((p) => {
      console.log(
        p._id.toString(),
        '→',
        p.name,
        `(${p.type}, ${p.size} نفره)`,
        p.owner ? '👤 متصل' : '— بدون صاحب',
      );
    });
    console.log('');
  }

  await mongoose.disconnect();
  process.exit(0);
}

run();
