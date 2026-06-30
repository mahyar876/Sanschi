/* ── API ── */
const API = 'http://localhost:5000/api';

/* ── FALLBACK DATA (فقط وقتی سرور جواب نده) ── */
const FALLBACK_PITCHES = [
  {
    id: '1',
    name: 'سالن فوتسال آریا',
    type: 'futsal',
    size: 5,
    color1: '#0d3320',
    color2: '#051a0e',
    price: 180000,
    avail: 6,
    tags: ['سرپوشیده', 'رختکن', 'کفپوش PVC', 'نور مصنوعی'],
    address: 'خیابان ولیعصر، نرسیده به میدان ونک',
    featured: true,
  },
  {
    id: '2',
    name: 'چمن فوتبال پارک ملت',
    type: 'grass',
    size: 11,
    color1: '#0a2e10',
    color2: '#040f06',
    price: 320000,
    avail: 3,
    tags: ['چمن مصنوعی', 'روشنایی شبانه', 'پارکینگ', 'تریبون'],
    address: 'پارک ملت، بلوار کشاورز',
  },
  {
    id: '3',
    name: 'فوتسال ستاره شرق',
    type: 'futsal',
    size: 7,
    color1: '#0d2e1a',
    color2: '#060f08',
    price: 210000,
    avail: 8,
    tags: ['سرپوشیده', 'دوش', 'نوشیدنی', 'وای‌فای'],
    address: 'نارمک، خیابان دماوند',
  },
  {
    id: '4',
    name: 'زمین چمن رضایی',
    type: 'grass',
    size: 7,
    color1: '#082510',
    color2: '#030c05',
    price: 250000,
    avail: 4,
    tags: ['چمن طبیعی', 'تریبون', 'بوفه', 'رختکن'],
    address: 'تهران پارس، خیابان شکوفه',
  },
  {
    id: '5',
    name: 'سالن ورزشی امید',
    type: 'futsal',
    size: 5,
    color1: '#0d3320',
    color2: '#051a0e',
    price: 160000,
    avail: 5,
    tags: ['سرپوشیده', 'رختکن', 'مربی آزاد'],
    address: 'صادقیه، خیابان آیت‌الله کاشانی',
  },
  {
    id: '6',
    name: 'چمن فوتبال دانشگاه',
    type: 'grass',
    size: 11,
    color1: '#0a2e10',
    color2: '#040f06',
    price: 280000,
    avail: 2,
    tags: ['چمن مصنوعی', 'روشنایی شبانه', 'دوربین'],
    address: 'انقلاب، محوطه دانشگاه تهران',
  },
];

const typeLabel = { futsal: 'فوتسال', grass: 'چمن' };

function numFa(n) {
  return n.toString().replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
}
function priceFa(n) {
  return numFa((n || 0).toLocaleString('en'));
}

/* ── PITCH SVG ILLUSTRATION ── */
function cardVisual(p) {
  if (p.image) {
    return `<img src="${p.image}" style="width:100%;height:100%;object-fit:cover;display:block">`;
  }
  return pitchSVG(p);
}

function pitchSVG(p) {
  const isFutsal = p.type === 'futsal';
  const gid = String(p.id).replace(/[^a-zA-Z0-9]/g, ''); // برای امن بودن id توی svg
  if (isFutsal) {
    return `<svg class="pitch-svg" viewBox="0 0 400 220" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="g${gid}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${p.color1}"/>
          <stop offset="100%" stop-color="${p.color2}"/>
        </linearGradient>
        <radialGradient id="glow${gid}" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="rgba(34,197,94,0.07)"/>
          <stop offset="100%" stop-color="transparent"/>
        </radialGradient>
      </defs>
      <rect width="400" height="220" fill="url(#g${gid})"/>
      <rect width="400" height="220" fill="url(#glow${gid})"/>
      <rect x="16" y="14" width="368" height="192" rx="3" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>
      <line x1="200" y1="14" x2="200" y2="206" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>
      <circle cx="200" cy="110" r="42" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>
      <circle cx="200" cy="110" r="4" fill="rgba(255,255,255,0.2)"/>
      <rect x="16" y="62" width="60" height="96" fill="none" stroke="rgba(255,255,255,0.09)" stroke-width="1.2"/>
      <rect x="16" y="80" width="28" height="60" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
      <rect x="324" y="62" width="60" height="96" fill="none" stroke="rgba(255,255,255,0.09)" stroke-width="1.2"/>
      <rect x="356" y="80" width="28" height="60" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
      <path d="M16,14 Q28,14 28,26" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
      <path d="M384,14 Q372,14 372,26" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
      <path d="M16,206 Q28,206 28,194" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
      <path d="M384,206 Q372,206 372,194" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
    </svg>`;
  } else {
    return `<svg class="pitch-svg" viewBox="0 0 400 220" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="g${gid}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${p.color1}"/>
          <stop offset="100%" stop-color="${p.color2}"/>
        </linearGradient>
        <radialGradient id="glow${gid}" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="rgba(34,197,94,0.06)"/>
          <stop offset="100%" stop-color="transparent"/>
        </radialGradient>
      </defs>
      <rect width="400" height="220" fill="url(#g${gid})"/>
      ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<rect x="0" y="${i * 28}" width="400" height="14" fill="rgba(34,197,94,0.018)"/>`).join('')}
      <rect width="400" height="220" fill="url(#glow${gid})"/>
      <rect x="16" y="14" width="368" height="192" fill="none" stroke="rgba(255,255,255,0.13)" stroke-width="1.5"/>
      <line x1="200" y1="14" x2="200" y2="206" stroke="rgba(255,255,255,0.13)" stroke-width="1.5"/>
      <circle cx="200" cy="110" r="48" fill="none" stroke="rgba(255,255,255,0.11)" stroke-width="1.5"/>
      <circle cx="200" cy="110" r="4" fill="rgba(255,255,255,0.2)"/>
      <rect x="16" y="54" width="80" height="112" fill="none" stroke="rgba(255,255,255,0.09)" stroke-width="1.2"/>
      <rect x="16" y="74" width="38" height="72" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
      <rect x="304" y="54" width="80" height="112" fill="none" stroke="rgba(255,255,255,0.09)" stroke-width="1.2"/>
      <rect x="346" y="74" width="38" height="72" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
      <path d="M96,86 Q120,110 96,134" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
      <path d="M304,86 Q280,110 304,134" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
      <path d="M16,14 Q30,14 30,28" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
      <path d="M384,14 Q370,14 370,28" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
      <path d="M16,206 Q30,206 30,192" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
      <path d="M384,206 Q370,206 370,192" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
    </svg>`;
  }
}

/* ── STATE ── */
let pitches = [];
let currentFilter = 'all';
let currentSort = 'default';
let lightboxIndex = 0;
let displayList = [];

/* ── LOAD PITCHES FROM SERVER (با fallback) ── */
async function loadGalleryPitches() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${API}/pitches`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = await res.json();
    if (!data.success) throw new Error();

    pitches = data.pitches.map((p) => {
      // کمترین قیمت سانس‌ها (که ادمین ست کرده) رو نشون بده
      const slotPrices = (p.slots || [])
        .map((s) => s.sitePrice || s.price)
        .filter(Boolean);
      const minPrice = slotPrices.length
        ? Math.min(...slotPrices)
        : (p.price || 0) + (p.commissionAmount || 0);
      return {
        id: p._id,
        name: p.name,
        type: p.type,
        size: p.size,
        color1: p.color1 || '#0d3320',
        color2: p.color2 || '#051a0e',
        price: minPrice,
        avail: p.avail,
        tags: p.tags || [],
        address: p.address,
        desc: p.desc || '',
        image: p.image || '',
      };
    });
  } catch (e) {
    // اگه سرور جواب نداد، از داده‌های پشتیبان استفاده کن
    pitches = FALLBACK_PITCHES;
  }
  render();
}

/* ── RENDER ── */
function getFiltered() {
  let list = pitches.filter(
    (p) => currentFilter === 'all' || p.type === currentFilter,
  );
  if (currentSort === 'price-asc')
    list = [...list].sort((a, b) => a.price - b.price);
  if (currentSort === 'price-desc')
    list = [...list].sort((a, b) => b.price - a.price);
  if (currentSort === 'avail')
    list = [...list].sort((a, b) => b.avail - a.avail);
  return list;
}

function render() {
  displayList = getFiltered();
  const grid = document.getElementById('galleryGrid');
  document.getElementById('countDisplay').textContent = numFa(
    displayList.length,
  );

  if (!displayList.length) {
    grid.innerHTML = `<div class="empty-state"><h3>هیچ زمینی پیدا نشد</h3><p>فیلتر دیگری امتحان کن</p></div>`;
    return;
  }

  grid.innerHTML = displayList
    .map(
      (p, idx) => `
    <div class="gallery-card ${idx === 0 && currentFilter === 'all' && currentSort === 'default' ? 'featured' : ''}"
         onclick="openLightbox('${p.id}')">
    <div class="card-img">
        ${cardVisual(p)}
        <div class="card-overlay"></div>
        <div class="card-hover-reveal">
          <button class="reveal-btn">مشاهده جزئیات</button>
        </div>
        <div class="card-body">
          <div class="card-type-badge">${typeLabel[p.type]} · ${numFa(p.size)} نفره</div>
          <div class="card-title">${p.name}</div>
          <div class="card-meta">
            <span class="card-meta-item"><span class="avail-dot"></span> ${numFa(p.avail || 0)} سانس خالی</span>
            <span class="card-price">از ${priceFa(p.price)} تومان</span>
          </div>
          <div class="card-tags">${(p.tags || [])
            .slice(0, 3)
            .map((t) => `<span class="tag">${t}</span>`)
            .join('')}</div>
        </div>
      </div>
    </div>
  `,
    )
    .join('');
}

/* ── LIGHTBOX ── */
function openLightbox(id) {
  lightboxIndex = displayList.findIndex((p) => String(p.id) === String(id));
  renderLightbox();
  document.getElementById('lightbox').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function renderLightbox() {
  const p = displayList[lightboxIndex];
  if (!p) return;

  document.getElementById('lbImg').innerHTML =
    cardVisual(p) + '<div class="lb-img-overlay"></div>';

  document.getElementById('lbBadge').textContent =
    typeLabel[p.type] + ' · ' + numFa(p.size) + ' نفره';
  document.getElementById('lbTitle').textContent = p.name;

  document.getElementById('lbInfoGrid').innerHTML = `
    <div class="lb-info-item">
      <div class="lb-info-label">از قیمت</div>
      <div class="lb-info-value green">از ${priceFa(p.price)} تومان</div>
    </div>
    <div class="lb-info-item">
      <div class="lb-info-label">سانس‌های خالی</div>
      <div class="lb-info-value green">${numFa(p.avail || 0)} سانس</div>
    </div>
    <div class="lb-info-item">
      <div class="lb-info-label">آدرس</div>
      <div class="lb-info-value" style="font-size:12px;line-height:1.5">${p.address}</div>
    </div>
  `;

  document.getElementById('lbTags').innerHTML = (p.tags || [])
    .map((t) => `<span class="lb-tag">${t}</span>`)
    .join('');

  document.getElementById('lbReserveBtn').onclick = () => {
    window.location.href = `./reserve.html?pitch=${p.id}`;
  };
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
  document.body.style.overflow = '';
}

function navLightbox(dir) {
  lightboxIndex =
    (lightboxIndex + dir + displayList.length) % displayList.length;
  renderLightbox();
}

function sharePitch() {
  const p = displayList[lightboxIndex];
  if (navigator.share) {
    navigator.share({
      title: p.name,
      text: `رزرو ${p.name} در سانس‌چی`,
      url: window.location.href,
    });
  } else {
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => alert('لینک کپی شد!'));
  }
}

/* ── EVENTS ── */
document.querySelectorAll('.chip').forEach((btn) => {
  btn.addEventListener('click', () => {
    document
      .querySelectorAll('.chip')
      .forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    render();
  });
});

document.getElementById('sortSelect').addEventListener('change', (e) => {
  currentSort = e.target.value;
  render();
});

document.getElementById('lightbox').addEventListener('click', (e) => {
  if (e.target.id === 'lightbox') closeLightbox();
});

document.addEventListener('keydown', (e) => {
  if (!document.getElementById('lightbox').classList.contains('open')) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowRight') navLightbox(-1);
  if (e.key === 'ArrowLeft') navLightbox(1);
});

/* ── INIT ── */
loadGalleryPitches();

/* ── Show "حساب من" if logged in ── */
(function () {
  const user = sessionStorage.getItem('sns_user');
  const loginBtn = document.querySelector('.header .btn');
  if (user && loginBtn) {
    loginBtn.textContent = 'حساب من';
    loginBtn.href = './profile.html';
    loginBtn.style.background = 'transparent';
    loginBtn.style.color = 'var(--green)';
    loginBtn.style.border = '1.5px solid var(--green)';
    loginBtn.style.boxShadow = 'none';
  }
})();
