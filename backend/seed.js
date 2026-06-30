const mongoose = require('mongoose');
const dotenv   = require('dotenv');
dotenv.config();

const pitchSchema = new mongoose.Schema({
  name: String, type: String, size: Number, price: Number,
  address: String, desc: String, tags: [String],
  color1: String, color2: String, isActive: { type: Boolean, default: true },
  slots: { type: Array, default: () => [
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
  ]}
});

const Pitch = mongoose.model('Pitch', pitchSchema);

const pitches = [
  {
    name: 'سالن فوتسال آریا', type: 'futsal', size: 5,
    price: 180000, address: 'خیابان ولیعصر، نرسیده به میدان ونک',
    desc: 'سالن استاندارد فوتسال با کفپوش حرفه‌ای، رختکن مجزا و سیستم روشنایی کامل.',
    tags: ['سرپوشیده', 'رختکن', 'کفپوش PVC', 'نور مصنوعی'],
    color1: '#0d3320', color2: '#051a0e',
  },
  {
    name: 'چمن فوتبال پارک ملت', type: 'grass', size: 11,
    price: 320000, address: 'پارک ملت، بلوار کشاورز',
    desc: 'زمین چمن مصنوعی استاندارد فوتبال ۱۱ نفره با سیستم روشنایی حرفه‌ای.',
    tags: ['چمن مصنوعی', 'روشنایی شبانه', 'پارکینگ', 'تریبون'],
    color1: '#0a2e10', color2: '#040f06',
  },
  {
    name: 'فوتسال ستاره شرق', type: 'futsal', size: 7,
    price: 210000, address: 'نارمک، خیابان دماوند',
    desc: 'مدرن‌ترین سالن فوتسال منطقه با امکانات کامل شامل دوش گرم و کافه.',
    tags: ['سرپوشیده', 'دوش', 'نوشیدنی', 'وای‌فای'],
    color1: '#0d2e1a', color2: '#060f08',
  },
  {
    name: 'زمین چمن رضایی', type: 'grass', size: 7,
    price: 250000, address: 'تهران پارس، خیابان شکوفه',
    desc: 'یکی از معدود زمین‌های چمن طبیعی شهر با خاک استاندارد.',
    tags: ['چمن طبیعی', 'تریبون', 'بوفه', 'رختکن'],
    color1: '#082510', color2: '#030c05',
  },
  {
    name: 'سالن ورزشی امید', type: 'futsal', size: 5,
    price: 160000, address: 'صادقیه، خیابان آیت‌الله کاشانی',
    desc: 'سالن فوتسال مناسب و مقرون‌به‌صرفه با محیط صمیمی.',
    tags: ['سرپوشیده', 'رختکن', 'مربی آزاد'],
    color1: '#0d3320', color2: '#051a0e',
  },
  {
    name: 'چمن فوتبال دانشگاه', type: 'grass', size: 11,
    price: 280000, address: 'انقلاب، محوطه دانشگاه تهران',
    desc: 'زمین ۱۱ نفره با چمن مصنوعی درجه یک و سیستم دوربین.',
    tags: ['چمن مصنوعی', 'روشنایی شبانه', 'دوربین'],
    color1: '#0a2e10', color2: '#040f06',
  },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ متصل به MongoDB');

    await Pitch.deleteMany({});
    console.log('🗑️  زمین‌های قبلی پاک شدن');

    await Pitch.insertMany(pitches);
    console.log(`✅ ${pitches.length} زمین اضافه شد`);

    await mongoose.disconnect();
    console.log('🎉 تموم شد!');
    process.exit(0);
  } catch (err) {
    console.error('❌ خطا:', err.message);
    process.exit(1);
  }
}

seed();