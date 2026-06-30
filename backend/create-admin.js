// create-admin.js — بذار داخل پوشه backend
// اجرا: node create-admin.js

const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

// مدل User رو مستقیم اینجا تعریف میکنیم
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  email: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    default: null,
  },
  password: { type: String, select: false },
  role: { type: String, default: 'user' },
  createdAt: { type: Date, default: Date.now },
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

// ── اطلاعات ادمین — اینجا عوض کن ──
const ADMIN_EMAIL = 'admin@sanschi.ir';
const ADMIN_PASS = 'Admin@1234';
const ADMIN_PHONE = '09337752754';
const ADMIN_NAME = 'مدیر سیستم';

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ متصل به MongoDB:', mongoose.connection.name);

    let user = await User.findOne({ email: ADMIN_EMAIL });

    if (user) {
      // آپدیت رمز و role
      user.password = ADMIN_PASS;
      user.role = 'admin';
      await user.save();
      console.log('✅ ادمین موجود آپدیت شد');
    } else {
      // چک کن phone تکراری نباشه
      const phoneExists = await User.findOne({ phone: ADMIN_PHONE });
      if (phoneExists) {
        // اگه phone تکراریه فقط role و email اضافه کن
        phoneExists.email = ADMIN_EMAIL;
        phoneExists.password = ADMIN_PASS;
        phoneExists.role = 'admin';
        await phoneExists.save();
        console.log('✅ یوزر موجود ارتقا به ادمین پیدا کرد');
      } else {
        user = new User({
          name: ADMIN_NAME,
          phone: ADMIN_PHONE,
          email: ADMIN_EMAIL,
          password: ADMIN_PASS,
          role: 'admin',
        });
        await user.save();
        console.log('✅ ادمین جدید ساخته شد');
      }
    }

    console.log('');
    console.log('══════════════════════════════');
    console.log('  اطلاعات ورود به پنل ادمین  ');
    console.log('══════════════════════════════');
    console.log('  📧 ایمیل :', ADMIN_EMAIL);
    console.log('  🔑 رمز   :', ADMIN_PASS);
    console.log('══════════════════════════════');
    console.log('');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ خطا:', err.message);
    process.exit(1);
  }
}

run();
