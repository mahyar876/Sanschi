/* ════════════════════════════════════════
   PAYMENT PAGE LOGIC — سانس‌چی
   اطلاعات رزرو از URL params میاد، کد تخفیف اعمال می‌شه،
   مبلغ نهایی محاسبه و دکمه پرداخت (آماده اتصال به زرین‌پال) نمایش داده می‌شه.
   ════════════════════════════════════════ */

const API = 'http://localhost:5000/api';

/* ── HELPERS ── */
function getParam(key) {
  return new URLSearchParams(window.location.search).get(key) || '';
}
function numFa(n) {
  return n.toString().replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
}
function priceFa(n) {
  return numFa((n || 0).toLocaleString('en'));
}
function priceFaWords(n) {
  n = parseInt(n) || 0;
  if (n >= 1000000 && n % 1000000 === 0)
    return numFa((n / 1000000).toLocaleString('en')) + ' میلیون تومان';
  if (n >= 1000000) {
    const m = (n / 1000000).toFixed(3).replace(/\.?0+$/, '');
    return numFa(m) + ' میلیون تومان';
  }
  if (n % 1000 === 0)
    return numFa((n / 1000).toLocaleString('en')) + ' هزار تومان';
  return priceFa(n) + ' تومان';
}

/* ── READ RESERVATION DATA ── */
const orderData = {
  reservationId: getParam('reservationId'),
  recurringGroupId: getParam('recurringGroupId'),
  pitchName: getParam('pitchName') || '—',
  pitchType: getParam('pitchType') || '—',
  date: getParam('date') || '—',
  time: getParam('time') || '—',
  name: getParam('name') || '—',
  phone: getParam('phone') || '—',
  count: getParam('count') || '—',
  amount: parseInt(getParam('amount')) || 0,
};

/* ── POPULATE SUMMARY ── */
function fill(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
fill('orderPitchName', orderData.pitchName);
fill('orderPitchType', orderData.pitchType);
fill('orderDate', orderData.date);
fill('orderTime', orderData.time);
fill('orderName', orderData.name);
fill('orderPhone', orderData.phone);
fill('orderCount', orderData.count === '—' ? '—' : orderData.count + ' نفر');

/* ── PRICE STATE ── */
let appliedDiscount = 0;
let finalAmount = orderData.amount;

function renderPrices() {
  fill('priceSubtotal', priceFa(orderData.amount) + ' تومان');

  const discRow = document.getElementById('priceDiscountRow');
  if (appliedDiscount > 0) {
    discRow.style.display = 'flex';
    fill('priceDiscount', '− ' + priceFa(appliedDiscount) + ' تومان');
  } else {
    discRow.style.display = 'none';
  }

  finalAmount = Math.max(0, orderData.amount - appliedDiscount);
  fill('priceTotal', priceFa(finalAmount) + ' تومان');
  fill('btnAmount', priceFaWords(finalAmount));
}
renderPrices();

/* ── DISCOUNT ── */
function applyDiscount() {
  const inp = document.getElementById('discountInput');
  const code = inp.value.trim().toUpperCase();
  const msg = document.getElementById('discountMsg');
  const badge = document.getElementById('discountBadge');

  if (!code) {
    msg.textContent = 'کد تخفیف را وارد کنید';
    msg.className = 'disc-msg err';
    return;
  }

  let found = false;
  let pct = 0;
  try {
    const store = JSON.parse(localStorage.getItem('sanschi_discounts') || '{}');
    if (store[code] && !store[code].used && Date.now() < store[code].exp) {
      pct = store[code].pct;
      appliedDiscount = Math.round((orderData.amount * pct) / 100);
      found = true;
      store[code].used = true;
      localStorage.setItem('sanschi_discounts', JSON.stringify(store));
    }
  } catch (e) {}

  if (!found) {
    appliedDiscount = 0;
    msg.textContent = 'کد تخفیف نامعتبر یا منقضی شده است';
    msg.className = 'disc-msg err';
    inp.className = 'disc-input invalid';
    renderPrices();
    return;
  }

  msg.textContent = '✓ کد معتبر — ' + numFa(pct) + '٪ تخفیف اعمال شد!';
  msg.className = 'disc-msg ok';
  inp.className = 'disc-input valid';
  inp.disabled = true;

  badge.className = 'disc-badge show';
  document.getElementById('discountBadgeText').textContent =
    '🎟 ' + code + ' — ' + priceFa(appliedDiscount) + ' تومان تخفیف';

  renderPrices();
}
window.applyDiscount = applyDiscount;

function removeDiscount() {
  appliedDiscount = 0;
  const inp = document.getElementById('discountInput');
  inp.value = '';
  inp.disabled = false;
  inp.className = 'disc-input';
  document.getElementById('discountMsg').className = 'disc-msg';
  document.getElementById('discountMsg').textContent = '';
  document.getElementById('discountBadge').className = 'disc-badge';
  renderPrices();
}
window.removeDiscount = removeDiscount;

document.getElementById('discountInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') applyDiscount();
});

/* ════════════════════════════════════════
   PAYMENT — اتصال به درگاه زرین‌پال
   ────────────────────────────────────────
   ۱) درخواست ساخت تراکنش به بک‌اند → دریافت URL درگاه
   ۲) ریدایرکت کاربر به درگاه زرین‌پال
   ۳) بازگشت از درگاه → بک‌اند verify می‌کند و کاربر را با
      ?payResult=success|failed به همین صفحه برمی‌گرداند (handleReturn).

   حالت دمو: اگر کاربر لاگین نیست یا رزرو mock است، چون تراکنش
   واقعی ممکن نیست، رسید موفق دموی نمایش داده می‌شود.
   ════════════════════════════════════════ */
async function startPayment() {
  const btn = document.getElementById('payBtn');
  btn.disabled = true;
  btn.classList.add('loading');

  const token = sessionStorage.getItem('sns_token');
  const isMock =
    !token ||
    !orderData.reservationId ||
    String(orderData.reservationId).startsWith('mock');

  // ── حالت دمو (بدون بک‌اند/درگاه) ──
  if (isMock) {
    await new Promise((r) => setTimeout(r, 600));
    btn.classList.remove('loading');
    showSuccess();
    return;
  }

  // ── حالت واقعی: درخواست تراکنش از زرین‌پال ──
  try {
    const res = await fetch(`${API}/payment/zarinpal/request`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        reservationId: orderData.reservationId,
        recurringGroupId: orderData.recurringGroupId,
        amount: finalAmount,
        discount: appliedDiscount,
        returnQuery: window.location.search, // برای بازگرداندن اطلاعات رزرو پس از پرداخت
      }),
    });
    const data = await res.json();
    if (data.success && data.url) {
      window.location.href = data.url; // ← ریدایرکت به درگاه زرین‌پال
      return;
    }
    throw new Error(data.message || 'خطا در اتصال به درگاه پرداخت');
  } catch (err) {
    btn.classList.remove('loading');
    btn.disabled = false;
    showPayError(err.message || 'خطا در اتصال به درگاه پرداخت');
  }
}
window.startPayment = startPayment;

/* ── نمایش خطای پرداخت ── */
function showPayError(msg) {
  let box = document.getElementById('payErrorBox');
  if (!box) {
    box = document.createElement('div');
    box.id = 'payErrorBox';
    box.className = 'pay-error';
    const btn = document.getElementById('payBtn');
    btn.parentNode.insertBefore(box, btn);
  }
  box.textContent = '⚠️ ' + msg;
  box.style.display = 'block';
}

/* ── مدیریت بازگشت از درگاه ── */
function handleReturn() {
  const result = getParam('payResult');
  if (!result) return;
  if (result === 'success') {
    const code = getParam('code');
    if (code) document.getElementById('finalCode').textContent = code;
    showSuccess(getParam('refId'));
  } else if (result === 'failed') {
    showPayError('پرداخت ناموفق بود یا لغو شد. می‌توانید دوباره تلاش کنید.');
  }
}
handleReturn();

function authHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

/* ── SUCCESS ── */
function showSuccess(refId) {
  // اگر کد از سمت سرور ست شده باشد همان را نگه می‌داریم، وگرنه کد دمو می‌سازیم
  let code = document.getElementById('finalCode').textContent.trim();
  if (!code || code === 'SNS-XXXXXX') {
    code = 'SNS-' + Math.random().toString(36).substr(2, 6).toUpperCase();
    fill('finalCode', code);
  }
  const trackId = refId || Math.floor(Math.random() * 9000000000) + 1000000000;

  // ذخیره رزرو mock برای صفحه پروفایل
  try {
    const existing = JSON.parse(
      sessionStorage.getItem('sns_mock_reservations') || '[]',
    );
    existing.unshift({
      id: orderData.reservationId || 'mock-' + Date.now(),
      code,
      pitch: orderData.pitchName,
      pitchName: orderData.pitchName,
      slotTime: orderData.time,
      date: orderData.date,
      playerCount: parseInt(orderData.count) || 0,
      amount: finalAmount,
      status: 'paid',
    });
    sessionStorage.setItem(
      'sns_mock_reservations',
      JSON.stringify(existing.slice(0, 20)),
    );
  } catch (e) {}

  document.getElementById('successDetail').innerHTML = `
    <div class="sd-row"><span class="sl">زمین</span><span class="sr">${orderData.pitchName}</span></div>
    <div class="sd-row"><span class="sl">تاریخ</span><span class="sr">${orderData.date}</span></div>
    <div class="sd-row"><span class="sl">ساعت</span><span class="sr">${orderData.time}</span></div>
    <div class="sd-row"><span class="sl">رزروکننده</span><span class="sr">${orderData.name}</span></div>
    <div class="sd-row"><span class="sl">مبلغ پرداختی</span><span class="sr" style="color:var(--green)">${priceFaWords(finalAmount)}</span></div>
    <div class="sd-row"><span class="sl">شماره پیگیری</span><span class="sr" style="direction:ltr;font-family:monospace">${trackId}</span></div>
  `;

  document.getElementById('successScreen').classList.add('show');
}
