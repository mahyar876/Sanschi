// assign-owner.js
// اجرا: node assign-owner.js <pitchId> <phone>
// مثال: node assign-owner.js 665f1a2b3c4d5e6f7a8b9c0d 09121234567
//
// شرط: کاربر باید از قبل با همین شماره تو سایت ثبت‌نام کرده باشه
// (مثل ثبت‌نام عادی از login.html). این اسکریپت فقط زمین رو به
// حسابش وصل می‌کنه — بعدش می‌تونه با همون شماره/رمز یا OTP خودش
// وارد owner.html بشه و فقط همین زمین رو ببینه و مدیریت کنه.

const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();
const User = require('./models/User');
const Pitch = require('./models/Pitch');

async function run() {
  const pitchId = process.argv[2];
  const phone = process.argv[3];

  if (!pitchId || !phone) {
    console.log('استفاده: node assign-owner.js <pitchId> <phone>');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  const user = await User.findOne({ phone });
  if (!user) {
    console.log('❌ کاربری با این شماره پیدا نشد.');
    console.log(
      '   اول باید با همین شماره از سایت (login.html) ثبت‌نام کرده باشه.',
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  const pitch = await Pitch.findByIdAndUpdate(
    pitchId,
    { owner: user._id },
    { new: true },
  );

  if (!pitch) {
    console.log('❌ زمینی با این آیدی پیدا نشد.');
  } else {
    console.log('✅ زمین به این کاربر متصل شد:');
    console.log('   زمین :', pitch.name, '(' + pitch._id + ')');
    console.log('   صاحب :', user.name, '|', user.phone);
    console.log('');
    console.log(
      'حالا این کاربر می‌تونه با همون شماره/ایمیلش وارد owner.html بشه',
    );
    console.log('و مستقیم بره تو پنل مدیریت همین زمین.');
  }

  await mongoose.disconnect();
  process.exit(0);
}

run();
