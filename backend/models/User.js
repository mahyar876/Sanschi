const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'نام الزامی است'],
    trim: true,
    minlength: [3, 'نام باید حداقل ۳ کاراکتر باشد'],
  },
  phone: {
    type: String,
    required: [true, 'شماره موبایل الزامی است'],
    unique: true,
    match: [/^09[0-9]{9}$/, 'شماره موبایل معتبر نیست'],
  },
  email: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    validate: {
      validator: function (v) {
        if (v === null || v === undefined || v === '') return true;
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'ایمیل معتبر نیست',
    },
  },
  password: {
    type: String,
    minlength: [8, 'رمز عبور باید حداقل ۸ کاراکتر باشد'],
    select: false, // پیش‌فرض برنمیگرده
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  createdAt: { type: Date, default: Date.now },
});

// Hash رمز قبل از ذخیره
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// مقایسه رمز
userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
