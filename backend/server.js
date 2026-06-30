const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');

dotenv.config();

const app = express();

async function ensureUserEmailIndex() {
  try {
    const users = mongoose.connection.collection('users');
    try {
      await users.dropIndex('email_1');
    } catch (e) {}
    await users.createIndex(
      { email: 1 },
      {
        unique: true,
        partialFilterExpression: { email: { $type: 'string', $ne: '' } },
      },
    );
    console.log('✅ users.email partial unique index ensured');
  } catch (e) {
    console.log('email index ensure skipped:', e.message);
  }
}

app.set('trust proxy', 1);

// ── MIDDLEWARE ──
app.use(
  cors({
    origin: '*',
    credentials: true,
  }),
);

app.use(express.json({ limit: '8mb' }));

// ── RATE LIMIT ──
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
});
// app.use('/api/auth/', authLimiter);

const path = require('path');
app.use(express.static(path.join(__dirname, '../frontend/pages')));
app.use('/assets', express.static(path.join(__dirname, '../frontend/assets')));

// ── ROUTES ──
app.use('/api/auth', require('./routes/auth'));
app.use('/api/pitches', require('./routes/pitches'));
app.use('/api/reservations', require('./routes/reservations'));
app.use('/api/owner', require('./routes/owner')); // ← پنل صاحب زمین
app.use('/api/settlements', require('./settlements')); // ← تسویه مالی
app.use('/api/payment', require('./routes/payment')); // ← درگاه پرداخت زرین‌پال

// ── ADMIN RESET ──
app.post(
  '/api/admin/reset',
  require('./routes/auth').protect || ((req, res, next) => next()),
  async (req, res) => {
    try {
      const jwt = require('jsonwebtoken');
      const auth = req.headers.authorization;
      if (!auth || !auth.startsWith('Bearer '))
        return res
          .status(401)
          .json({ success: false, message: 'ابتدا وارد شوید' });
      const decoded = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET);
      const User = require('./models/User');
      const user = await User.findById(decoded.id);
      if (!user || user.role !== 'admin')
        return res.status(403).json({ success: false, message: 'فقط ادمین' });

      const { type } = req.body;
      const Reservation = require('./models/Reservation');
      const Settlement = require('./Settlement');
      const DailyAvailability = require('./models/DailyAvailability');

      let deleted = {};
      if (type === 'reservations' || type === 'all') {
        const r = await Reservation.deleteMany({});
        deleted.reservations = r.deletedCount;
      }
      if (type === 'settlements' || type === 'all') {
        const s = await Settlement.deleteMany({});
        deleted.settlements = s.deletedCount;
      }
      if (type === 'all') {
        const d = await DailyAvailability.deleteMany({});
        deleted.dailyAvailability = d.deletedCount;
      }

      res.json({
        success: true,
        message: `پاک شد: ${JSON.stringify(deleted)}`,
        deleted,
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
);

// ── HEALTH ──
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    db: mongoose.connection.readyState === 1,
  });
});

// ── DB ──
console.log('MONGO_URI =', process.env.MONGO_URI);
mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('MongoDB connected');
    console.log(
      '✅ DB Name:',
      mongoose.connection.name,
      '| Host:',
      mongoose.connection.host,
    );

    await ensureUserEmailIndex();

    const PORT = process.env.PORT || 5000;

    app.listen(PORT, () => {
      console.log(`Server running on ${PORT}`);
    });
  })
  .catch((err) => {
    console.log('Mongo error:', err);
  });
