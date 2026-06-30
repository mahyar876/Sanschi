# سانس‌چی — بک‌اند

**Node.js + Express + MongoDB**

---

## راه‌اندازی

### ۱. پیش‌نیازها

- [Node.js](https://nodejs.org) نسخه ۱۸+
- [MongoDB](https://www.mongodb.com/try/download/community) نصب‌شده روی سیستم (یا MongoDB Atlas)

### ۲. نصب

```bash
cd backend
npm install
```

### ۳. تنظیم .env

```bash
cp .env.example .env
```

فایل `.env` رو باز کن و مقادیر رو پر کن:

```
MONGO_URI=mongodb://localhost:27017/sanschi
JWT_SECRET=یه_کلید_طولانی_و_تصادفی
PORT=5000
NODE_ENV=development
```

### ۴. اجرا

**حالت توسعه (با hot-reload):**

```bash
npm run dev
```

**حالت production:**

```bash
npm start
```

سرور روی `http://localhost:5000` بالا میاد.
زمین‌ها به صورت خودکار seed میشن.

---

## API Endpoints

### Auth

| Method | URL                    | توضیح                 |
| ------ | ---------------------- | --------------------- |
| POST   | `/api/auth/register`   | ثبت‌نام               |
| POST   | `/api/auth/login`      | ورود با ایمیل+رمز     |
| POST   | `/api/auth/send-otp`   | ارسال OTP به موبایل   |
| POST   | `/api/auth/verify-otp` | تأیید OTP             |
| GET    | `/api/auth/me`         | اطلاعات کاربر فعلی 🔒 |
| PATCH  | `/api/auth/me`         | ویرایش پروفایل 🔒     |

### Pitches

| Method | URL                        | توضیح                |
| ------ | -------------------------- | -------------------- |
| GET    | `/api/pitches`             | لیست زمین‌ها         |
| GET    | `/api/pitches?type=futsal` | فیلتر نوع            |
| GET    | `/api/pitches?sort=price`  | مرتب‌سازی            |
| GET    | `/api/pitches/:id`         | جزئیات زمین          |
| GET    | `/api/pitches/:id/slots`   | سانس‌های زمین        |
| POST   | `/api/pitches`             | اضافه کردن زمین 🔒👑 |
| PATCH  | `/api/pitches/:id`         | ویرایش زمین 🔒👑     |
| DELETE | `/api/pitches/:id`         | غیرفعال کردن 🔒👑    |

### Reservations

| Method | URL                         | توضیح           |
| ------ | --------------------------- | --------------- |
| POST   | `/api/reservations`         | ثبت رزرو 🔒     |
| POST   | `/api/reservations/:id/pay` | تأیید پرداخت 🔒 |
| GET    | `/api/reservations/my`      | رزروهای من 🔒   |
| DELETE | `/api/reservations/:id`     | لغو رزرو 🔒     |
| GET    | `/api/reservations`         | همه رزروها 🔒👑 |

🔒 = نیاز به JWT  
👑 = فقط ادمین

---

## نمونه درخواست‌ها

### ثبت‌نام

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"علی رضایی","phone":"09121234567","password":"mypass123"}'
```

### ورود

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ali@example.com","password":"mypass123"}'
```

### لیست زمین‌ها

```bash
curl http://localhost:5000/api/pitches
```

### ثبت رزرو (با token)

```bash
curl -X POST http://localhost:5000/api/reservations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"pitchId":"...","slotIndex":4,"date":"1403/03/24","playerCount":5}'
```

---

## اتصال فرانت‌اند به بک‌اند

در فایل‌های HTML، توابع API call رو اضافه کن. مثلاً در `login.html`:

```javascript
// جایگزین کن sendToken مصنوعی رو با این:
const res = await fetch('http://localhost:5000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const data = await res.json();
if (data.success) {
  sessionStorage.setItem('sns_token', data.token);
  sessionStorage.setItem('sns_user', JSON.stringify(data.user));
}
```
