// make-admin.js
// اجرا: node make-admin.js 09xxxxxxxxx
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();
const User = require('./models/User');

async function run() {
  const phone = process.argv[2];
  if (!phone) {
    console.log('استفاده: node make-admin.js 09xxxxxxxxx');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.findOneAndUpdate(
    { phone },
    { role: 'admin' },
    { new: true },
  );
  if (!user) {
    console.log('❌ کاربری با این شماره پیدا نشد. اول باید ثبت‌نام کرده باشی.');
  } else {
    console.log(
      '✅ کاربر ادمین شد:',
      user.name,
      user.phone,
      '| ایمیل:',
      user.email,
    );
  }
  await mongoose.disconnect();
  process.exit(0);
}

run();
