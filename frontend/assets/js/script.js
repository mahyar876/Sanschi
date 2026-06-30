// =========================
// SHARED UTILITIES
// =========================
function numFa(n) {
  return n.toString().replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
}
function priceFa(n) {
  return numFa(n.toLocaleString('en'));
}
function priceFaWords(n) {
  n = parseInt(n) || 0;
  if (n >= 1000000 && n % 1000000 === 0) {
    return numFa((n / 1000000).toLocaleString('en')) + ' میلیون تومان';
  }
  if (n >= 1000000) {
    const m = (n / 1000000).toFixed(3).replace(/\.?0+$/, '');
    return numFa(m) + ' میلیون تومان';
  }
  if (n % 1000 === 0) {
    return numFa((n / 1000).toLocaleString('en')) + ' هزار تومان';
  }
  return priceFa(n) + ' تومان';
}

// =========================
// شمسی (Jalali)
// =========================
function gregorianToJalali(gy, gm, gd) {
  var g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  var jy = gy <= 1600 ? 0 : 979;
  gy -= gy <= 1600 ? 621 : 1600;
  var gy2 = gm > 2 ? gy + 1 : gy;
  var days =
    365 * gy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) -
    80 +
    gd +
    g_d_m[gm - 1];
  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  var jm, jd;
  if (days < 186) {
    jm = 1 + Math.floor(days / 31);
    jd = 1 + (days % 31);
  } else {
    jm = 7 + Math.floor((days - 186) / 30);
    jd = 1 + ((days - 186) % 30);
  }
  return [jy, jm, jd];
}

var JALALI_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];
var JALALI_WEEKDAYS = [
  'شنبه',
  'یکشنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنجشنبه',
  'جمعه',
];

function toJalaliString(input) {
  var d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return String(input);
  var j = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  var weekday = JALALI_WEEKDAYS[d.getDay()];
  return (
    weekday +
    ' ' +
    numFa(j[2]) +
    ' ' +
    JALALI_MONTHS[j[1] - 1] +
    ' ' +
    numFa(j[0])
  );
}

// تاریخ شمسی به فرمت API: "1403/03/24"
function toJalaliApiDate(input) {
  var d = input instanceof Date ? input : new Date(input);
  var j = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return (
    j[0] +
    '/' +
    String(j[1]).padStart(2, '0') +
    '/' +
    String(j[2]).padStart(2, '0')
  );
}

function toJalaliParts(input) {
  var d = input instanceof Date ? input : new Date(input);
  var j = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return { y: j[0], m: j[1], d: j[2] };
}

function jalaliToGregorian(jy, jm, jd) {
  var gy = jy <= 979 ? 621 : 1600;
  jy -= jy <= 979 ? 0 : 979;
  var days =
    365 * jy +
    Math.floor(jy / 33) * 8 +
    Math.floor(((jy % 33) + 3) / 4) +
    78 +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  gy += 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  var gd = days + 1;
  var sal_a = [
    0,
    31,
    (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  var gm;
  for (gm = 0; gm < 13; gm++) {
    var v = sal_a[gm];
    if (gd <= v) break;
    gd -= v;
  }
  return [gy, gm, gd];
}

function daysInJalaliMonth(jy, jm) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  var g1 = jalaliToGregorian(jy, 12, 29);
  var g2 = jalaliToGregorian(jy + 1, 1, 1);
  var d1 = new Date(g1[0], g1[1] - 1, g1[2]);
  var d2 = new Date(g2[0], g2[1] - 1, g2[2]);
  return d2 - d1 === 86400000 ? 29 : 30;
}

// =========================
// INDEX PAGE ONLY
// =========================
if (document.getElementById('topBtn')) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) e.target.classList.add('show');
      });
    },
    { threshold: 0.2 },
  );
  document
    .querySelectorAll('.card, .how-step, .stat')
    .forEach((el) => observer.observe(el));

  document.querySelectorAll('[data-target]').forEach((counter) => {
    const updateCounter = () => {
      const target = +counter.dataset.target;
      const current = +counter.innerText;
      const increment = target / 100;
      if (current < target) {
        counter.innerText = Math.ceil(current + increment);
        requestAnimationFrame(updateCounter);
      } else {
        counter.innerText = target.toLocaleString('fa-IR');
      }
    };
    updateCounter();
  });

  const topBtn = document.getElementById('topBtn');
  window.addEventListener('scroll', () => {
    topBtn.classList.toggle('active', window.scrollY > 500);
  });
  topBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  (function () {
    const user = sessionStorage.getItem('sns_user');
    const loginBtn = document.querySelector('.header .btn');
    if (user && loginBtn) {
      loginBtn.textContent = 'حساب من';
      loginBtn.href = './profile.html';
      loginBtn.classList.remove('btn-ghost');
      loginBtn.style.background = 'transparent';
      loginBtn.style.color = 'var(--green)';
      loginBtn.style.border = '1.5px solid var(--green)';
      loginBtn.style.boxShadow = 'none';
    }
  })();

  (function () {
    const countEl = document.getElementById('liveCount');
    if (!countEl) return;
    let current = Math.floor(Math.random() * 5) + 2;
    function updateCount() {
      countEl.textContent = numFa(current);
      const delta = Math.random() < 0.5 ? 1 : -1;
      current = Math.max(1, Math.min(9, current + delta));
    }
    updateCount();
    setInterval(updateCount, Math.floor(Math.random() * 4000) + 4000);
  })();

  (function () {
    const secEl = document.getElementById('timerSec');
    if (!secEl) return;
    function randomTime() {
      return Math.floor(Math.random() * 31) + 45;
    }
    let target = randomTime();
    let current = 60;
    secEl.textContent = numFa(current);
    setInterval(function () {
      if (current === target) {
        setTimeout(function () {
          target = randomTime();
        }, 2000);
        return;
      }
      current += current < target ? 1 : -1;
      secEl.textContent = numFa(current);
    }, 800);
  })();

  (function () {
    const dateEl = document.getElementById('heroDate');
    if (!dateEl) return;
    try {
      dateEl.textContent = toJalaliString(new Date());
    } catch (e) {}
  })();
}

// =========================
// RESERVE PAGE ONLY
// =========================
window.SNS = {
  API: 'http://localhost:5000/api',
  typeLabel: { futsal: 'فوتسال', grass: 'چمن' },
  pitches: [],
  filteredList: [],
  selectedPitch: null,
  selectedSlot: null,
  selectedDate: null,
  recurringMode: false,
};

function renderWeekdayChecks() {
  var wrap = document.getElementById('weekdayChecks');
  if (!wrap) return;
  wrap.innerHTML = JALALI_WEEKDAYS.map(function (name, i) {
    return (
      '<label style="display:flex;align-items:center;gap:4px;font-size:13px;background:#0a1a10;border:1px solid var(--green-border);border-radius:8px;padding:6px 10px;cursor:pointer">' +
      '<input type="checkbox" class="weekday-check" value="' +
      i +
      '" onchange="updateSummary()" style="accent-color:var(--green)">' +
      name +
      '</label>'
    );
  }).join('');
}

function toggleRecurringUI() {
  SNS.recurringMode = document.getElementById('recurringToggle').checked;
  document.getElementById('recurringBox').style.display = SNS.recurringMode
    ? 'block'
    : 'none';
  SNS.selectedSlot = null;
  if (SNS.selectedPitch) {
    if (SNS.recurringMode) renderSlots();
    else loadAndRenderSlots(SNS.selectedPitch._id || SNS.selectedPitch.id);
  }
  updateSummary();
}
window.toggleRecurringUI = toggleRecurringUI;

function computeRecurringDates(checkedDays, weeks) {
  var dates = [];
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  checkedDays.forEach(function (wd) {
    var diff = (wd - today.getDay() + 7) % 7;
    var first = new Date(today);
    first.setDate(first.getDate() + diff);
    for (var k = 0; k < weeks; k++) {
      var d = new Date(first);
      d.setDate(d.getDate() + 7 * k);
      dates.push(toJalaliApiDate(d));
    }
  });
  return dates;
}

// ══════════════════════════════════════════════════════
// سانس‌های پیش‌فرض (fallback)
// ══════════════════════════════════════════════════════
const DEFAULT_SLOT_DEFS = [
  { time: '۰۶:۰۰–۰۷:۳۰', price: 550000 },
  { time: '۰۷:۳۰–۰۹:۰۰', price: 550000 },
  { time: '۰۹:۰۰–۱۰:۳۰', price: 550000 },
  { time: '۱۰:۳۰–۱۲:۰۰', price: 550000 },
  { time: '۱۲:۰۰–۱۳:۳۰', price: 550000 },
  { time: '۱۳:۳۰–۱۵:۰۰', price: 550000 },
  { time: '۱۵:۰۰–۱۶:۳۰', price: 550000 },
  { time: '۱۶:۳۰–۱۸:۰۰', price: 700000 },
  { time: '۱۸:۰۰–۱۹:۳۰', price: 700000 },
  { time: '۱۹:۳۰–۲۱:۰۰', price: 700000 },
  { time: '۲۱:۰۰–۲۲:۳۰', price: 700000 },
];

const DEFAULT_STATIC_PITCHES_RAW = [
  {
    id: '1',
    name: 'سالن فوتسال آریا',
    type: 'futsal',
    size: 5,
    price: 180000,
    color1: '#0d3320',
    color2: '#051a0e',
    tags: ['سرپوشیده', 'رختکن', 'کفپوش PVC', 'نور مصنوعی'],
    address: 'خیابان ولیعصر، نرسیده به میدان ونک',
    takenArr: [
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ],
  },
  {
    id: '2',
    name: 'چمن فوتبال پارک ملت',
    type: 'grass',
    size: 11,
    price: 320000,
    color1: '#0a2e10',
    color2: '#040f06',
    tags: ['چمن مصنوعی', 'روشنایی شبانه', 'پارکینگ', 'تریبون'],
    address: 'پارک ملت، بلوار کشاورز',
    takenArr: [
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ],
  },
  {
    id: '3',
    name: 'فوتسال ستاره شرق',
    type: 'futsal',
    size: 7,
    price: 210000,
    color1: '#0d2e1a',
    color2: '#060f08',
    tags: ['سرپوشیده', 'دوش', 'نوشیدنی', 'وای‌فای'],
    address: 'نارمک، خیابان دماوند',
    takenArr: [
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ],
  },
  {
    id: '4',
    name: 'زمین چمن رضایی',
    type: 'grass',
    size: 7,
    price: 250000,
    color1: '#082510',
    color2: '#030c05',
    tags: ['چمن طبیعی', 'تریبون', 'بوفه', 'رختکن'],
    address: 'تهران پارس، خیابان شکوفه',
    takenArr: [
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ],
  },
  {
    id: '5',
    name: 'سالن ورزشی امید',
    type: 'futsal',
    size: 5,
    price: 160000,
    color1: '#0d3320',
    color2: '#051a0e',
    tags: ['سرپوشیده', 'رختکن', 'مربی آزاد'],
    address: 'صادقیه، خیابان آیت‌الله کاشانی',
    takenArr: [
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ],
  },
  {
    id: '6',
    name: 'چمن فوتبال دانشگاه',
    type: 'grass',
    size: 11,
    price: 280000,
    color1: '#0a2e10',
    color2: '#040f06',
    tags: ['چمن مصنوعی', 'روشنایی شبانه', 'دوربین'],
    address: 'انقلاب، محوطه دانشگاه تهران',
    takenArr: [
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ],
  },
];

function buildStaticPitches() {
  return DEFAULT_STATIC_PITCHES_RAW.map(function (def) {
    var slots = DEFAULT_SLOT_DEFS.map(function (s, si) {
      return {
        time: s.time,
        price: s.price,
        taken: def.takenArr[si] || false,
      };
    });
    return {
      id: def.id,
      name: def.name,
      type: def.type,
      size: def.size,
      price: def.price,
      avail: slots.filter((s) => !s.taken).length,
      color1: def.color1,
      color2: def.color2,
      tags: def.tags,
      address: def.address,
      isActive: true,
      slots: slots,
    };
  });
}

// ════════════════════════════════════
// JALALI DATE PICKER
// ════════════════════════════════════
var jpViewYear, jpViewMonth;

function toggleJalaliPicker() {
  var picker = document.getElementById('jalaliPicker');
  if (picker.classList.contains('open')) {
    picker.classList.remove('open');
    return;
  }
  var base = SNS.selectedDate || new Date();
  var jp = toJalaliParts(base);
  jpViewYear = jp.y;
  jpViewMonth = jp.m;
  renderJalaliPicker();
  picker.classList.add('open');
}
window.toggleJalaliPicker = toggleJalaliPicker;

function jpChangeMonth(delta) {
  jpViewMonth += delta;
  if (jpViewMonth < 1) {
    jpViewMonth = 12;
    jpViewYear--;
  }
  if (jpViewMonth > 12) {
    jpViewMonth = 1;
    jpViewYear++;
  }
  renderJalaliPicker();
}
window.jpChangeMonth = jpChangeMonth;

function renderJalaliPicker() {
  var picker = document.getElementById('jalaliPicker');
  var todayParts = toJalaliParts(new Date());
  var selectedParts = SNS.selectedDate ? toJalaliParts(SNS.selectedDate) : null;
  var firstGregArr = jalaliToGregorian(jpViewYear, jpViewMonth, 1);
  var firstGregDate = new Date(
    firstGregArr[0],
    firstGregArr[1] - 1,
    firstGregArr[2],
  );
  var startOffset = firstGregDate.getDay();
  var totalDays = daysInJalaliMonth(jpViewYear, jpViewMonth);
  var todayGreg = new Date();
  todayGreg.setHours(0, 0, 0, 0);
  var cellsHtml = '';
  for (var i = 0; i < startOffset; i++) {
    cellsHtml += '<span class="jp-day jp-day-empty"></span>';
  }
  for (var d = 1; d <= totalDays; d++) {
    var gArr = jalaliToGregorian(jpViewYear, jpViewMonth, d);
    var gDate = new Date(gArr[0], gArr[1] - 1, gArr[2]);
    gDate.setHours(0, 0, 0, 0);
    var isPast = gDate < todayGreg;
    var isToday =
      todayParts.y === jpViewYear &&
      todayParts.m === jpViewMonth &&
      todayParts.d === d;
    var isSelected =
      selectedParts &&
      selectedParts.y === jpViewYear &&
      selectedParts.m === jpViewMonth &&
      selectedParts.d === d;
    var cls = 'jp-day';
    if (isToday) cls += ' jp-today';
    if (isSelected) cls += ' jp-selected';
    if (isPast) cls += ' jp-disabled';
    cellsHtml +=
      '<span class="' +
      cls +
      '" ' +
      (isPast ? '' : 'onclick="jpSelectDay(' + d + ')"') +
      '>' +
      numFa(d) +
      '</span>';
  }
  picker.innerHTML =
    '<div class="jp-head">' +
    '<button type="button" class="jp-nav-btn" onclick="jpChangeMonth(-1)">›</button>' +
    '<span class="jp-title">' +
    JALALI_MONTHS[jpViewMonth - 1] +
    ' ' +
    numFa(jpViewYear) +
    '</span>' +
    '<button type="button" class="jp-nav-btn" onclick="jpChangeMonth(1)">‹</button>' +
    '</div>' +
    '<div class="jp-weekdays">' +
    ['ی', 'د', 'س', 'چ', 'پ', 'ج', 'ش']
      .map((w) => '<span>' + w + '</span>')
      .join('') +
    '</div>' +
    '<div class="jp-days">' +
    cellsHtml +
    '</div>';
}

function jpSelectDay(d) {
  var gArr = jalaliToGregorian(jpViewYear, jpViewMonth, d);
  SNS.selectedDate = new Date(gArr[0], gArr[1] - 1, gArr[2]);
  document.getElementById('dateFilter').value = toJalaliString(
    SNS.selectedDate,
  );
  document.getElementById('jalaliPicker').classList.remove('open');
  // وقتی تاریخ عوض شد، سانس‌ها رو reload کن
  if (SNS.selectedPitch) {
    SNS.selectedSlot = null;
    loadAndRenderSlots(SNS.selectedPitch._id || SNS.selectedPitch.id);
  }
  updateSummary();
}
window.jpSelectDay = jpSelectDay;

document.addEventListener('click', function (e) {
  var picker = document.getElementById('jalaliPicker');
  var input = document.getElementById('dateFilter');
  if (!picker) return;
  var path = e.composedPath ? e.composedPath() : [e.target];
  if (
    picker.classList.contains('open') &&
    path.indexOf(input) === -1 &&
    path.indexOf(picker) === -1
  ) {
    picker.classList.remove('open');
  }
});

// ── فیلتر ──
function applyStaticFilter(pitches) {
  const type = document.getElementById('typeFilter').value;
  const size = parseInt(document.getElementById('sizeFilter').value) || 0;
  const sort = document.getElementById('sortFilter').value;
  let list = pitches.slice();
  if (type) list = list.filter((p) => p.type === type);
  if (size && size !== 0) list = list.filter((p) => p.size === size);
  if (sort === 'price') list.sort((a, b) => a.price - b.price);
  else if (sort === 'avail') list.sort((a, b) => b.avail - a.avail);
  return list;
}

// ── LOAD PITCHES ──
async function loadPitches() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(SNS.API + '/pitches', {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = await res.json();
    if (!data.success) throw new Error();
    const mapped = data.pitches.map((p) => {
      const slotPrices = (p.slots || [])
        .map((s) => s.sitePrice || s.price)
        .filter(Boolean);
      const minPrice = slotPrices.length
        ? Math.min(...slotPrices)
        : (p.price || 0) + (p.commissionAmount || 0);
      return {
        _id: p._id,
        name: p.name,
        type: p.type,
        size: p.size,
        price: minPrice,
        avail: p.avail,
        color1: p.color1 || '#0d3320',
        color2: p.color2 || '#051a0e',
        tags: p.tags || [],
        address: p.address,
        isActive: p.isActive,
        slots: p.slots,
        image: p.image || '',
      };
    });
    SNS.pitches = mapped;
    SNS._allStatic = mapped;
    SNS.filteredList = applyStaticFilter(mapped);
  } catch (e) {
    const freshPitches = buildStaticPitches();
    SNS._allStatic = freshPitches;
    SNS.pitches = freshPitches;
    SNS.filteredList = applyStaticFilter(freshPitches);
  }
  renderPitches();
}
window.loadPitches = loadPitches;

// ─── LOAD SLOTS با تاریخ ───
// این تابع حالا تاریخ شمسی رو به API پاس میده
async function loadSlots(pitchId) {
  try {
    // تاریخ شمسی به فرمت "1403/03/24"
    const apiDate = SNS.selectedDate ? toJalaliApiDate(SNS.selectedDate) : '';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const url = apiDate
      ? `${SNS.API}/pitches/${pitchId}/slots?date=${encodeURIComponent(apiDate)}`
      : `${SNS.API}/pitches/${pitchId}/slots`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    return data.slots;
  } catch (err) {
    const staticPitch =
      SNS._allStatic && SNS._allStatic.find((p) => (p._id || p.id) === pitchId);
    return staticPitch ? staticPitch.slots : [];
  }
}

async function loadAndRenderSlots(pitchId) {
  const slots = await loadSlots(pitchId);
  if (SNS.selectedPitch) SNS.selectedPitch._slots = slots;
  renderSlots();
}

// ── RENDER PITCHES ──
function renderPitches() {
  const grid = document.getElementById('pitchesGrid');
  const countEl = document.getElementById('pitchCount');
  countEl.textContent = numFa(SNS.filteredList.length) + ' زمین در دسترس';
  if (!SNS.filteredList.length) {
    grid.innerHTML =
      '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted)">هیچ زمینی با این فیلتر پیدا نشد</div>';
    return;
  }
  grid.innerHTML = SNS.filteredList
    .map(function (p) {
      var pid = p._id || p.id;
      var cover = p.color1 || '#0d3320';
      var isSelected =
        SNS.selectedPitch &&
        (SNS.selectedPitch._id || SNS.selectedPitch.id) === pid;
      var tags = (p.tags || [])
        .slice(0, 3)
        .map((t) => '<span class="pitch-tag">' + t + '</span>')
        .join('');
      return (
        '<div class="pitch-card ' +
        (isSelected ? 'selected' : '') +
        '" onclick="selectPitch(\'' +
        pid +
        '\')">' +
        '<div class="select-check">✓</div>' +
        '<div class="pitch-thumb" style="' +
        (p.image
          ? "background-image:url('" +
            p.image +
            "');background-size:cover;background-position:center;"
          : 'background:linear-gradient(140deg,' + cover + ',#060e09)') +
        '">' +
        (p.image ? '' : '<div class="pitch-thumb-circle"></div>') +
        '<div class="pitch-type-badge">' +
        SNS.typeLabel[p.type] +
        '</div>' +
        '</div>' +
        '<div class="pitch-body">' +
        '<div class="pitch-name">' +
        p.name +
        '</div>' +
        '<div class="pitch-meta">' +
        tags +
        '<span class="pitch-tag">' +
        numFa(p.size) +
        ' نفره</span></div>' +
        '<div class="pitch-price-row">' +
        '<div class="pitch-price">از ' +
        priceFaWords(p.price) +
        ' <span>/ هر سانس</span></div>' +
        '<div class="pitch-avail"><strong>' +
        numFa(p.avail || 0) +
        '</strong> سانس خالی</div>' +
        '</div></div></div>'
      );
    })
    .join('');
}

// ── SELECT PITCH ──
async function selectPitch(id) {
  SNS.selectedPitch = SNS.pitches.find((p) => p._id === id || p.id === id);
  SNS.selectedSlot = null;
  renderPitches();
  updateSummary();
  setStep(2);
  if (SNS.recurringMode) renderSlots();
  else await loadAndRenderSlots(SNS.selectedPitch._id || SNS.selectedPitch.id);
  setTimeout(function () {
    document
      .getElementById('slotsSection')
      .scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 80);
}
window.selectPitch = selectPitch;

// ── RENDER SLOTS ──
function renderSlots() {
  var sec = document.getElementById('slotsSection');
  var grid = document.getElementById('slotsGrid');
  var nameEl = document.getElementById('selectedPitchName');
  if (!SNS.selectedPitch) {
    sec.style.display = 'none';
    return;
  }
  sec.style.display = 'block';

  if (SNS.recurringMode) {
    nameEl.textContent =
      SNS.selectedPitch.name + ' — انتخاب ساعت (برای روزهای انتخابی)';
    var baseSlots = SNS.selectedPitch.slots || [];
    grid.innerHTML = baseSlots
      .map(function (slot, i) {
        var isSelected = SNS.selectedSlot === i;
        return (
          '<div class="slot ' +
          (isSelected ? 'slot-selected' : '') +
          '" onclick="selectSlot(' +
          i +
          ')">' +
          '<span class="slot-time">' +
          slot.time +
          '</span>' +
          '<span class="slot-price">' +
          priceFaWords(
            slot.sitePrice || slot.price || SNS.selectedPitch.price,
          ) +
          '</span></div>'
        );
      })
      .join('');
    return;
  }

  nameEl.textContent = SNS.selectedPitch.name;
  var slots = SNS.selectedPitch._slots || [];
  var dateLabel = SNS.selectedDate ? toJalaliString(SNS.selectedDate) : '';
  // عنوان با تاریخ
  document.getElementById('selectedPitchName').textContent =
    SNS.selectedPitch.name + (dateLabel ? ' — ' + dateLabel : '');

  grid.innerHTML = slots
    .map(function (slot, i) {
      var isTaken = slot.taken;
      var isSelected =
        SNS.selectedSlot ===
        (slot.slotIndex !== undefined ? slot.slotIndex : i);
      return (
        '<div class="slot ' +
        (isTaken ? 'slot-taken' : '') +
        ' ' +
        (isSelected ? 'slot-selected' : '') +
        '" ' +
        (isTaken
          ? ''
          : 'onclick="selectSlot(' +
            (slot.slotIndex !== undefined ? slot.slotIndex : i) +
            ')"') +
        '>' +
        '<span class="slot-time">' +
        slot.time +
        '</span>' +
        '<span class="slot-price">' +
        (isTaken
          ? 'رزرو شده'
          : priceFaWords(
              slot.sitePrice || slot.price || SNS.selectedPitch.price,
            )) +
        '</span>' +
        '</div>'
      );
    })
    .join('');
}

function selectSlot(i) {
  SNS.selectedSlot = i;
  renderSlots();
  updateSummary();
  setStep(3);
  checkSubmit();
}
window.selectSlot = selectSlot;

function getSlotTime() {
  if (SNS.recurringMode) {
    var ls = SNS.selectedPitch && SNS.selectedPitch.slots;
    if (SNS.selectedSlot === null || !ls) return 'انتخاب نشده';
    return ls[SNS.selectedSlot] ? ls[SNS.selectedSlot].time : 'انتخاب نشده';
  }
  if (
    SNS.selectedSlot === null ||
    !SNS.selectedPitch ||
    !SNS.selectedPitch._slots
  )
    return 'انتخاب نشده';
  var slot = SNS.selectedPitch._slots.find(
    (s) =>
      (s.slotIndex !== undefined
        ? s.slotIndex
        : SNS.selectedPitch._slots.indexOf(s)) === SNS.selectedSlot,
  );
  return slot ? slot.time : 'انتخاب نشده';
}

function getSlotPrice() {
  if (SNS.recurringMode) {
    var ls = SNS.selectedPitch && SNS.selectedPitch.slots;
    if (SNS.selectedSlot === null || !ls)
      return SNS.selectedPitch ? SNS.selectedPitch.price : 0;
    var s = ls[SNS.selectedSlot];
    // sitePrice اگه بود استفاده کن (قیمت با کمیسیون)
    return s ? s.sitePrice || s.price : SNS.selectedPitch.price;
  }
  if (
    SNS.selectedSlot === null ||
    !SNS.selectedPitch ||
    !SNS.selectedPitch._slots
  ) {
    return SNS.selectedPitch ? SNS.selectedPitch.price : 0;
  }
  var slot = SNS.selectedPitch._slots.find(
    (s) =>
      (s.slotIndex !== undefined
        ? s.slotIndex
        : SNS.selectedPitch._slots.indexOf(s)) === SNS.selectedSlot,
  );
  // sitePrice = قیمت با کمیسیون که از API میاد
  return slot ? slot.sitePrice || slot.price : SNS.selectedPitch.price;
}
function updateSummary() {
  var el = document.getElementById('summaryContent');
  if (!SNS.selectedPitch) {
    el.innerHTML = '<div class="summary-empty">هنوز زمینی انتخاب نشده</div>';
    return;
  }
  if (SNS.recurringMode) {
    var checkedDays = [
      ...document.querySelectorAll('.weekday-check:checked'),
    ].map((c) => parseInt(c.value));
    var dayNames = checkedDays.map((d) => JALALI_WEEKDAYS[d]).join('، ') || '—';
    var weeks =
      parseInt(document.getElementById('recurringDuration').value) || 4;
    var total = getSlotPrice() * checkedDays.length * weeks;
    el.innerHTML =
      '<div class="summary-row"><span class="label">زمین</span><span class="value">' +
      SNS.selectedPitch.name +
      '</span></div>' +
      '<div class="summary-row"><span class="label">روزها</span><span class="value">' +
      dayNames +
      '</span></div>' +
      '<div class="summary-row"><span class="label">ساعت</span><span class="value">' +
      getSlotTime() +
      '</span></div>' +
      '<div class="summary-row"><span class="label">مدت</span><span class="value">' +
      (weeks === 52 ? 'یک سال' : 'یک ماه') +
      '</span></div>' +
      '<div class="summary-row"><span class="label">مبلغ کل</span><span class="value green">' +
      priceFaWords(total) +
      '</span></div>';
    checkSubmit();
    return;
  }

  var dateStr = SNS.selectedDate
    ? toJalaliString(SNS.selectedDate)
    : 'انتخاب نشده';
  var slotStr = getSlotTime();
  el.innerHTML =
    '<div class="summary-row"><span class="label">زمین</span><span class="value">' +
    SNS.selectedPitch.name +
    '</span></div>' +
    '<div class="summary-row"><span class="label">نوع</span><span class="value">' +
    SNS.typeLabel[SNS.selectedPitch.type] +
    '</span></div>' +
    '<div class="summary-row"><span class="label">تاریخ</span><span class="value">' +
    dateStr +
    '</span></div>' +
    '<div class="summary-row"><span class="label">ساعت</span><span class="value">' +
    slotStr +
    '</span></div>' +
    '<div class="summary-row"><span class="label">مبلغ</span><span class="value green">' +
    priceFaWords(getSlotPrice()) +
    '</span></div>';
  checkSubmit();
}

async function applyFilter() {
  await loadPitches();
  if (
    SNS.selectedPitch &&
    !SNS.filteredList.find(
      (p) =>
        (p._id || p.id) === (SNS.selectedPitch._id || SNS.selectedPitch.id),
    )
  ) {
    SNS.selectedPitch = null;
    SNS.selectedSlot = null;
    renderSlots();
    updateSummary();
    setStep(1);
  }
}
window.applyFilter = applyFilter;

function checkSubmit() {
  var name = document.getElementById('userName').value.trim();
  var phone = document.getElementById('userPhone').value.trim();
  var phoneOk = /^09[0-9]{9}$/.test(phone);
  var ok =
    SNS.selectedPitch &&
    SNS.selectedSlot !== null &&
    name.length >= 3 &&
    phoneOk;
  if (SNS.recurringMode) {
    ok = ok && document.querySelectorAll('.weekday-check:checked').length > 0;
  }
  document.getElementById('submitBtn').disabled = !ok;
  document.getElementById('userPhone').style.borderColor =
    phone && !phoneOk ? '#ef4444' : '';
  if (ok) setStep(4);
  else if (SNS.selectedPitch && SNS.selectedSlot !== null) setStep(3);
}

function setStep(n) {
  var labels = ['', '۱', '۲', '۳', '۴'];
  for (var i = 1; i <= 4; i++) {
    var item = document.getElementById('step' + i + '-item');
    var circle = item.querySelector('.step-circle');
    if (i < n) {
      item.className = 'step-item done';
      circle.textContent = '✓';
    } else if (i === n) {
      item.className = 'step-item active';
      circle.textContent = labels[i];
    } else {
      item.className = 'step-item';
      circle.textContent = labels[i];
    }
  }
}

function isLoggedIn() {
  return sessionStorage.getItem('sns_user') !== null;
}

function showLoginPrompt() {
  document.getElementById('loginPrompt').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLoginPrompt() {
  document.getElementById('loginPrompt').classList.remove('open');
  document.body.style.overflow = '';
}
window.closeLoginPrompt = closeLoginPrompt;

function openPayModal() {
  if (!SNS.selectedPitch || SNS.selectedSlot === null) return;
  if (!isLoggedIn()) {
    showLoginPrompt();
    return;
  }
  var name = document.getElementById('userName').value.trim();
  var phone = document.getElementById('userPhone').value.trim();
  var count = document.getElementById('userCount').value;
  var note = document.getElementById('userNote').value.trim();

  if (SNS.recurringMode) {
    var checkedDays = [
      ...document.querySelectorAll('.weekday-check:checked'),
    ].map((c) => parseInt(c.value));
    var dayNames = checkedDays.map((d) => JALALI_WEEKDAYS[d]).join('، ');
    var weeks =
      parseInt(document.getElementById('recurringDuration').value) || 4;
    var total = getSlotPrice() * checkedDays.length * weeks;
    document.getElementById('modalSummary').innerHTML =
      '<div class="modal-row"><span class="ml">زمین</span><span class="mr">' +
      SNS.selectedPitch.name +
      '</span></div>' +
      '<div class="modal-row"><span class="ml">روزها</span><span class="mr">' +
      dayNames +
      '</span></div>' +
      '<div class="modal-row"><span class="ml">ساعت</span><span class="mr">' +
      getSlotTime() +
      '</span></div>' +
      '<div class="modal-row"><span class="ml">مدت</span><span class="mr">' +
      (weeks === 52 ? 'یک سال' : 'یک ماه') +
      '</span></div>' +
      '<div class="modal-row total"><span class="ml">مبلغ کل</span><span class="mr">' +
      priceFaWords(total) +
      '</span></div>';
    document.getElementById('payModal').classList.add('open');
    document.body.style.overflow = 'hidden';
    return;
  }

  var dateStr = SNS.selectedDate ? toJalaliString(SNS.selectedDate) : '—';
  var slotStr = getSlotTime();
  document.getElementById('modalSummary').innerHTML =
    '<div class="modal-row"><span class="ml">زمین</span><span class="mr">' +
    SNS.selectedPitch.name +
    '</span></div>' +
    '<div class="modal-row"><span class="ml">تاریخ</span><span class="mr">' +
    dateStr +
    '</span></div>' +
    '<div class="modal-row"><span class="ml">ساعت</span><span class="mr">' +
    slotStr +
    '</span></div>' +
    '<div class="modal-row"><span class="ml">رزروکننده</span><span class="mr">' +
    name +
    '</span></div>' +
    '<div class="modal-row"><span class="ml">موبایل</span><span class="mr">' +
    phone +
    '</span></div>' +
    '<div class="modal-row"><span class="ml">نفرات</span><span class="mr">' +
    count +
    '</span></div>' +
    (note
      ? '<div class="modal-row"><span class="ml">توضیحات</span><span class="mr">' +
        note +
        '</span></div>'
      : '') +
    '<div class="modal-row total"><span class="ml">مبلغ کل</span><span class="mr">' +
    priceFaWords(getSlotPrice()) +
    '</span></div>';
  document.getElementById('payModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}
window.openPayModal = openPayModal;

function closePayModal() {
  document.getElementById('payModal').classList.remove('open');
  document.body.style.overflow = '';
}
window.closePayModal = closePayModal;

async function doPayment() {
  if (!SNS.selectedPitch || SNS.selectedSlot === null) return;
  var name = document.getElementById('userName').value.trim();
  var phone = document.getElementById('userPhone').value.trim();
  var count = document.getElementById('userCount').value;
  var payBtn0 = document.querySelector('.pay-btn');

  if (SNS.recurringMode) {
    var checkedDays = [
      ...document.querySelectorAll('.weekday-check:checked'),
    ].map((c) => parseInt(c.value));
    var weeks =
      parseInt(document.getElementById('recurringDuration').value) || 4;
    var dates = computeRecurringDates(checkedDays, weeks);
    var dayNames = checkedDays.map((d) => JALALI_WEEKDAYS[d]).join('، ');
    var slotStr = getSlotTime();
    var pitchType =
      SNS.typeLabel[SNS.selectedPitch.type] +
      ' · ' +
      numFa(SNS.selectedPitch.size) +
      ' نفره';
    if (payBtn0) {
      payBtn0.disabled = true;
      payBtn0.textContent = 'در حال ثبت رزرو تکراری...';
    }
    try {
      var token0 = sessionStorage.getItem('sns_token');
      var res0 = await fetch(SNS.API + '/reservations/recurring', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + (token0 || ''),
        },
        body: JSON.stringify({
          pitchId: SNS.selectedPitch._id || SNS.selectedPitch.id,
          slotIndex: SNS.selectedSlot,
          dates: dates,
          playerCount: parseInt(count),
          note: document.getElementById('userNote').value.trim(),
        }),
      });
      var data0 = await res0.json();
      if (!data0.success)
        throw new Error(data0.message || 'خطا در ثبت رزرو تکراری');
      closePayModal();
      var params0 = new URLSearchParams({
        recurringGroupId: data0.groupId,
        pitchName: SNS.selectedPitch.name,
        pitchType,
        date: dayNames + ' — ' + (weeks === 52 ? 'یک سال' : 'یک ماه'),
        time: slotStr,
        name,
        phone,
        count,
        amount: data0.totalAmount,
      });
      window.location.href = './payment.html?' + params0.toString();
    } catch (e) {
      if (payBtn0) {
        payBtn0.disabled = false;
        payBtn0.textContent = 'پرداخت آنلاین 🔒';
      }
      alert(e.message || 'خطا در ثبت رزرو تکراری');
    }
    return;
  }

  // تاریخ شمسی برای نمایش
  var dateStr = SNS.selectedDate ? toJalaliString(SNS.selectedDate) : '—';
  // تاریخ شمسی برای API
  var apiDate = SNS.selectedDate ? toJalaliApiDate(SNS.selectedDate) : '';
  var payBtn = document.querySelector('.pay-btn');
  if (payBtn) {
    payBtn.disabled = true;
    payBtn.textContent = 'در حال ثبت رزرو...';
  }
  var slotStr = getSlotTime();
  var pitchType =
    SNS.typeLabel[SNS.selectedPitch.type] +
    ' · ' +
    numFa(SNS.selectedPitch.size) +
    ' نفره';

  try {
    var token = sessionStorage.getItem('sns_token');
    var controller = new AbortController();
    setTimeout(() => controller.abort(), 3000);
    var res = await fetch(SNS.API + '/reservations', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + (token || ''),
      },
      body: JSON.stringify({
        pitchId: SNS.selectedPitch._id || SNS.selectedPitch.id,
        slotIndex: SNS.selectedSlot,
        date: apiDate, // ← تاریخ شمسی به فرمت "1403/03/24"
        playerCount: parseInt(count),
        note: document.getElementById('userNote').value.trim(),
      }),
    });
    var data = await res.json();
    if (data.success) {
      closePayModal();
      var params = new URLSearchParams({
        reservationId: data.reservation.id,
        pitchName: SNS.selectedPitch.name,
        pitchType,
        date: dateStr,
        time: slotStr,
        name,
        phone,
        count,
        amount: getSlotPrice(),
      });
      window.location.href = './payment.html?' + params.toString();
      return;
    }
  } catch (e) {
    /* fallback */
  }

  // حالت mock (بدون بک‌اند)
  closePayModal();
  var resId = 'mock-' + Date.now();
  var code = 'SNS-' + Math.random().toString(36).substr(2, 6).toUpperCase();
  var existing = JSON.parse(
    sessionStorage.getItem('sns_mock_reservations') || '[]',
  );
  existing.unshift({
    id: resId,
    code,
    pitch: SNS.selectedPitch.name,
    pitchName: SNS.selectedPitch.name,
    slotTime: slotStr,
    date: dateStr,
    playerCount: parseInt(count) || 0,
    amount: getSlotPrice(),
    status: 'pending',
    createdAt: new Date().toISOString(),
  });
  sessionStorage.setItem(
    'sns_mock_reservations',
    JSON.stringify(existing.slice(0, 20)),
  );
  var params = new URLSearchParams({
    reservationId: resId,
    code,
    pitchName: SNS.selectedPitch.name,
    pitchType,
    date: dateStr,
    time: slotStr,
    name,
    phone,
    count,
    amount: getSlotPrice(),
  });
  window.location.href = './payment.html?' + params.toString();
}
window.doPayment = doPayment;

document.addEventListener('click', function (e) {
  if (e.target.id === 'payModal') closePayModal();
  if (e.target.id === 'loginPrompt') closeLoginPrompt();
});

document.addEventListener('DOMContentLoaded', async function () {
  SNS.selectedDate = new Date();
  document.getElementById('dateFilter').value = toJalaliString(
    SNS.selectedDate,
  );
  renderWeekdayChecks();
  document.getElementById('userName').addEventListener('input', checkSubmit);
  document.getElementById('userPhone').addEventListener('input', checkSubmit);
  var user = sessionStorage.getItem('sns_user');
  var loginBtn = document.querySelector('.header .btn');
  if (user && loginBtn) {
    loginBtn.textContent = 'حساب من';
    loginBtn.href = './profile.html';
    loginBtn.style.background = 'transparent';
    loginBtn.style.color = 'var(--green)';
    loginBtn.style.border = '1.5px solid var(--green)';
    loginBtn.style.boxShadow = 'none';
  }
  // Add owner panel link if logged in
  (function () {
    var u = sessionStorage.getItem('sns_user');
    var nav = document.querySelector('.nav');
    if (u && nav) {
      var li = document.createElement('li');
      li.innerHTML =
        '<a href="./owner.html" style="color:var(--green)!important;font-weight:700">👤 پنل مالک</a>';
      nav.appendChild(li);
    }
  })();
  await loadPitches();
});
// end reserve page block
