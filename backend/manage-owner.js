// manage-owner.js
// ابزار مدیریت صاحب زمین (owner) از طریق ترمینال
//
// ── لیست همه زمین‌ها + صاحبشون ──
//   node manage-owner.js list
//
// ── متصل کردن یه زمین به یه شماره موبایل ──
//   node manage-owner.js set <pitchId> <phone>
//   مثال: node manage-owner.js set 665f1a2b3c4d5e6f7a8b9c0d 09121234567
//
// ── حذف صاحب از یه زمین (زمین بدون owner می‌شه، فقط ادمین می‌بینتش) ──
//   node manage-owner.js remove <pitchId>
//
// شرط «set»: کاربر باید از قبل با همین شماره تو سایت ثبت‌نام کرده باشه
// (از login.html — تب ثبت‌نام، یا با OTP).

const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();
const User = require('./models/User');
const Pitch = require('./models/Pitch');

async function listPitches() {
  const pitches = await Pitch.find().populate('owner', 'name phone');
  if (!pitches.length) {
    console.log('هیچ زمینی تو دیتابیس نیست.');
    return;
  }
  console.log('');
  pitches.forEach((p, i) => {
    console.log('----------------------------------------');
    console.log('# ' + (i + 1));
    console.log('نام زمین : ' + p.name);
    console.log('نوع      : ' + p.type + ' - ' + p.size + ' نفره');
    console.log(
      'صاحب     : ' +
        (p.owner ? p.owner.name + ' (' + p.owner.phone + ')' : 'بدون صاحب'),
    );
    console.log('آیدی     : ' + p._id.toString());
  });
  console.log('----------------------------------------');
  console.log('');
}

async function setOwner(pitchId, phone) {
  const user = await User.findOne({ phone });
  if (!user) {
    console.log('❌ کاربری با این شماره پیدا نشد.');
    console.log(
      '   اول باید با همین شماره از سایت (login.html) ثبت‌نام کرده باشه.',
    );
    return;
  }

  const pitch = await Pitch.findByIdAndUpdate(
    pitchId,
    { owner: user._id },
    { new: true },
  );

  if (!pitch) {
    console.log('❌ زمینی با این آیدی پیدا نشد.');
    return;
  }

  console.log('✅ زمین به این کاربر متصل شد:');
  console.log('   زمین :', pitch.name, '(' + pitch._id + ')');
  console.log('   صاحب :', user.name, '|', user.phone);
}

async function removeOwner(pitchId) {
  const pitch = await Pitch.findByIdAndUpdate(
    pitchId,
    { owner: null },
    { new: true },
  );

  if (!pitch) {
    console.log('❌ زمینی با این آیدی پیدا نشد.');
    return;
  }

  console.log('✅ صاحب این زمین حذف شد — الان فقط ادمین می‌تونه مدیریتش کنه:');
  console.log('   زمین :', pitch.name, '(' + pitch._id + ')');
}

async function run() {
  const cmd = process.argv[2];

  await mongoose.connect(process.env.MONGO_URI);

  if (cmd === 'list') {
    await listPitches();
  } else if (cmd === 'set') {
    const pitchId = process.argv[3];
    const phone = process.argv[4];
    if (!pitchId || !phone) {
      console.log('استفاده: node manage-owner.js set <pitchId> <phone>');
    } else {
      await setOwner(pitchId, phone);
    }
  } else if (cmd === 'remove') {
    const pitchId = process.argv[3];
    if (!pitchId) {
      console.log('استفاده: node manage-owner.js remove <pitchId>');
    } else {
      await removeOwner(pitchId);
    }
  } else {
    console.log('دستورات موجود:');
    console.log('  node manage-owner.js list');
    console.log('  node manage-owner.js set <pitchId> <phone>');
    console.log('  node manage-owner.js remove <pitchId>');
  }

  await mongoose.disconnect();
  process.exit(0);
}

run();
