// ═══════════════════════════════════════════
// اتصال به بک‌اند
// ═══════════════════════════════════════════
const API = 'http://localhost:5000/api';

// توکن همون تـوکنی هست که موقع ورود عادی (login.html) با حساب
// ادمین گرفته می‌شه و در sessionStorage ذخیره می‌شه.
function getToken() {
  return sessionStorage.getItem('sns_token') || '';
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`,
  };
}

function adminLogout() {
  sessionStorage.removeItem('sns_token');
  sessionStorage.removeItem('sns_user');
  window.location.href = './login.html?redirect=profile';
}
window.adminLogout = adminLogout;

// ═══════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════
const BASE_SLOT_TIMES = [
  '۰۶:۰۰–۰۷:۳۰',
  '۰۷:۳۰–۰۹:۰۰',
  '۰۹:۰۰–۱۰:۳۰',
  '۱۰:۳۰–۱۲:۰۰',
  '۱۲:۰۰–۱۳:۳۰',
  '۱۳:۳۰–۱۵:۰۰',
  '۱۵:۰۰–۱۶:۳۰',
  '۱۶:۳۰–۱۸:۰۰',
  '۱۸:۰۰–۱۹:۳۰',
  '۱۹:۳۰–۲۱:۰۰',
  '۲۱:۰۰–۲۲:۳۰',
];

const STATE = {
  selectedPitchIdx: 0,
  slots: BASE_SLOT_TIMES.map((t) => ({ time: t, price: 550000 })),
  pitches: [], // از سرور پر می‌شه
  reservations: [], // از سرور پر می‌شه (پنل رزروها)
};

// خوندن همهٔ زمین‌ها (حتی غیرفعال) از سرور واقعی
async function initAdminData() {
  try {
    const res = await fetch(`${API}/pitches?all=1`);
    const data = await res.json();
    if (!data.success) throw new Error();

    STATE.pitches = data.pitches.map((p) => ({
      id: p._id,
      name: p.name,
      type: p.type,
      size: p.size,
      isActive: p.isActive,
      price: p.price,
      commissionAmount: p.commissionAmount || 0,
      color1: p.color1 || '#0d3320',
      color2: p.color2 || '#051a0e',
      tags: p.tags || [],
      address: p.address,
      image: p.image || '',
      takenSlots: (p.slots || []).map((s) => s.taken),
      slotPrices: (p.slots || []).map((s) => s.price),
    }));

    if (
      data.pitches[0] &&
      data.pitches[0].slots &&
      data.pitches[0].slots.length
    ) {
      STATE.slots = data.pitches[0].slots.map((s) => ({
        time: s.time,
        price: s.price,
      }));
    }

    toast('✓ اطلاعات از سرور بارگذاری شد');
  } catch (e) {
    toast('❌ اتصال به سرور برقرار نشد — بررسی کن سرور روشن باشه', true);
  }
  renderPitchSelector();
  renderSlotsTable();
  renderPitchesGrid();
  setSaveStatus('');
}

// ═══════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════
const numFa = (n) => n.toString().replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
const priceFa = (n) => numFa((parseInt(n) || 0).toLocaleString('en'));
const typeLabel = { futsal: 'فوتسال سرپوشیده', grass: 'چمن فوتبال' };
const typeShort = { futsal: 'فوتسال', grass: 'چمن' };

let toastTimer;
function toast(msg, isErr, dur = 2600) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isErr ? ' err' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), dur);
}

function setSaveStatus(s) {
  const el = document.getElementById('saveStatus');
  const tx = document.getElementById('saveStatusText');
  el.className = 'save-status ' + s;
  if (s === 'saved') tx.textContent = 'روی سرور ذخیره شد';
  else if (s === 'saving') tx.textContent = 'در حال ذخیره...';
  else tx.textContent = 'تغییرات ذخیره‌نشده';
}

// markDirty فقط وضعیت رو نشون می‌ده — ذخیرهٔ واقعی با دکمهٔ «اعمال تغییرات» انجام می‌شه
function markDirty() {
  setSaveStatus('');
}

// ═══════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════
function showPanel(id) {
  document
    .querySelectorAll('.panel')
    .forEach((p) => p.classList.remove('active'));
  document
    .querySelectorAll('.nav-item')
    .forEach((n) => n.classList.remove('active'));
  document.getElementById('panel-' + id).classList.add('active');
  document.getElementById('nav-' + id).classList.add('active');
}
window.showPanel = showPanel;

// ═══════════════════════════════════════════
// ADD NEW PITCH
// ═══════════════════════════════════════════
let apImageData = '';

function handleApImage(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 4 * 1024 * 1024) {
    toast('❌ حجم عکس باید کمتر از ۴ مگابایت باشه', true);
    return;
  }
  const reader = new FileReader();
  reader.onload = function (ev) {
    apImageData = ev.target.result; // base64 data URL
    const preview = document.getElementById('apImgPreview');
    preview.src = apImageData;
    preview.style.display = 'block';
    document.getElementById('apImgPlaceholder').style.display = 'none';
  };
  reader.readAsDataURL(file);
}
window.handleApImage = handleApImage;

async function createPitch() {
  const name = document.getElementById('apName').value.trim();
  const type = document.getElementById('apType').value;
  const size = parseInt(document.getElementById('apSize').value);
  const price = parseInt(document.getElementById('apPrice').value) || 0;
  const address = document.getElementById('apAddress').value.trim();
  const desc = document.getElementById('apDesc').value.trim();
  const tags = document
    .getElementById('apTags')
    .value.split(/[،,]/)
    .map((t) => t.trim())
    .filter(Boolean);
  const msgEl = document.getElementById('apMsg');
  msgEl.className = 'save-msg';

  if (!name || !address || !price) {
    msgEl.textContent = 'نام، آدرس و قیمت الزامی هستن';
    msgEl.className = 'save-msg err';
    return;
  }

  /*      if (!getToken()) {
          msgEl.textContent =
            'اول باید از صفحه ورود، با یه حساب «ادمین» وارد بشی';
          msgEl.className = 'save-msg err';
          return;
        }
*/
  const btn = document.getElementById('apSubmitBtn');
  btn.disabled = true;
  btn.textContent = 'در حال ثبت...';

  try {
    const res = await fetch(`${API}/pitches`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        name,
        type,
        size,
        price,
        address,
        desc,
        tags,
        image: apImageData || '',
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'خطا در ثبت زمین');

    msgEl.textContent =
      '✓ زمین با موفقیت ثبت شد! حالا روی رزرو و گالری هم هست.';
    msgEl.className = 'save-msg ok';
    toast('✓ زمین «' + name + '» ثبت شد');

    // ریست فرم
    document.getElementById('apName').value = '';
    document.getElementById('apAddress').value = '';
    document.getElementById('apDesc').value = '';
    document.getElementById('apTags').value = '';
    document.getElementById('apPrice').value = '';
    apImageData = '';
    document.getElementById('apImgPreview').style.display = 'none';
    document.getElementById('apImgPlaceholder').style.display = 'block';

    await initAdminData(); // لیست زمین‌ها رو رفرش کن
  } catch (e) {
    msgEl.textContent = e.message;
    msgEl.className = 'save-msg err';
  } finally {
    btn.disabled = false;
    btn.textContent = '✓ ثبت زمین جدید';
  }
}
window.createPitch = createPitch;

// ═══════════════════════════════════════════
// IMAGE FOR EXISTING PITCH
// ═══════════════════════════════════════════
function handlePitchImage(i, e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 4 * 1024 * 1024) {
    toast('❌ حجم عکس باید کمتر از ۴ مگابایت باشه', true);
    return;
  }
  const reader = new FileReader();
  reader.onload = function (ev) {
    STATE.pitches[i].image = ev.target.result;
    const thumb = document.getElementById('pcfg-thumb-' + i);
    if (thumb) {
      thumb.style.backgroundImage = `url('${ev.target.result}')`;
      thumb.style.backgroundSize = 'cover';
      thumb.style.backgroundPosition = 'center';
      thumb.textContent = '';
    }
    const card = document.getElementById('pitch-card-' + i);
    if (card) card.classList.add('dirty');
    markDirty();
    toast('عکس آپدیت شد — یادت نره روی «اعمال تغییرات این زمین» بزنی!');
  };
  reader.readAsDataURL(file);
}
window.handlePitchImage = handlePitchImage;

// ═══════════════════════════════════════════
// SLOTS PANEL
// ═══════════════════════════════════════════
function renderPitchSelector() {
  const sel = document.getElementById('slotsPitchSelect');
  if (!sel) return;
  sel.innerHTML = STATE.pitches
    .map(
      (p, i) =>
        `<option value="${i}" ${i === STATE.selectedPitchIdx ? 'selected' : ''}>${p.name} — ${typeShort[p.type]} · ${numFa(p.size)} نفره</option>`,
    )
    .join('');
}

function onSlotsPitchChange(idx) {
  STATE.selectedPitchIdx = parseInt(idx);
  renderSlotsTable();
}
window.onSlotsPitchChange = onSlotsPitchChange;

function renderSlotsTable() {
  const tbody = document.getElementById('slotsTableBody');
  const pitch = STATE.pitches[STATE.selectedPitchIdx];
  if (!tbody || !pitch) {
    if (tbody) tbody.innerHTML = '';
    return;
  }

  tbody.innerHTML = STATE.slots
    .map((s, i) => {
      const price = pitch.slotPrices[i];
      const isPeak = price >= 700000;
      return `<tr>
      <td><span class="slot-num-badge">${numFa(i + 1)}</span></td>
      <td>
        <input class="tbl-input time" value="${s.time}"
          oninput="STATE.slots[${i}].time=this.value; markDirty()">
      </td>
      <td>
        <input class="tbl-input price" type="number" value="${price}" step="10000"
          oninput="STATE.pitches[${STATE.selectedPitchIdx}].slotPrices[${i}]=parseInt(this.value)||0; markDirty(); renderSlotsTable(); updateSlotMinis(${STATE.selectedPitchIdx})">
      </td>
      <td>
        <span class="peak-tag ${isPeak ? 'peak' : 'normal'}">${isPeak ? '🌙 اوج' : '☀️ عادی'}</span>
      </td>
    </tr>`;
    })
    .join('');
}

function applyBulkPrice() {
  const period = document.getElementById('bulkPeriod').value;
  const price = parseInt(document.getElementById('bulkPrice').value) || 0;
  if (!price) {
    toast('❌ قیمت را وارد کن', true);
    return;
  }
  const pitch = STATE.pitches[STATE.selectedPitchIdx];
  if (!pitch) return;
  STATE.slots.forEach((s, i) => {
    if (period === 'all') pitch.slotPrices[i] = price;
    else if (period === 'morning' && i <= 6) pitch.slotPrices[i] = price;
    else if (period === 'evening' && i >= 7) pitch.slotPrices[i] = price;
  });
  renderSlotsTable();
  updateSlotMinis(STATE.selectedPitchIdx);
  markDirty();
  toast(
    'قیمت‌های «' +
      pitch.name +
      '» در فرم به‌روز شد — یادت نره روی «اعمال تغییرات این زمین» بزنی!',
  );
}
window.applyBulkPrice = applyBulkPrice;

// ═══════════════════════════════════════════
// PITCHES GRID
// ═══════════════════════════════════════════
function renderPitchesGrid() {
  const grid = document.getElementById('pitchesGrid');
  if (!grid) return;

  if (!STATE.pitches.length) {
    grid.innerHTML =
      '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted)">هیچ زمینی پیدا نشد یا اتصال به سرور برقرار نیست</div>';
    return;
  }

  grid.innerHTML = STATE.pitches
    .map(
      (p, i) => `
    <div class="pitch-cfg" id="pitch-card-${i}">
      <div class="pcfg-head">
        <div class="pcfg-left">
          <div class="pcfg-num" id="pcfg-thumb-${i}" style="${p.image ? `background-image:url('${p.image}');background-size:cover;background-position:center;` : ''}">
            ${p.image ? '' : numFa(i + 1)}
          </div>
          <div>
            <div class="pcfg-name" id="pcfg-name-${i}">${p.name}</div>
            <div class="pcfg-type">${typeShort[p.type]} · ${numFa(p.size)} نفره</div>
          </div>
        </div>
        <button class="pcfg-active-toggle ${p.isActive ? 'on' : ''}" id="toggle-${i}"
          onclick="toggleActive(${i})" title="${p.isActive ? 'فعال (کلیک برای غیرفعال)' : 'غیرفعال (کلیک برای فعال)'}">
        </button>
      </div>

      <div class="pcfg-body">
        <div class="cfg-row">
          <span class="cfg-label">نام زمین</span>
          <input class="cfg-input" value="${p.name}" id="inp-name-${i}"
            oninput="updatePitch(${i},'name',this.value)">
        </div>
        <div class="cfg-row-inline">
          <div class="cfg-row">
            <span class="cfg-label">نوع</span>
            <select class="cfg-input" onchange="updatePitch(${i},'type',this.value)">
              <option value="futsal" ${p.type === 'futsal' ? 'selected' : ''}>فوتسال</option>
              <option value="grass" ${p.type === 'grass' ? 'selected' : ''}>چمن</option>
            </select>
          </div>
          <div class="cfg-row">
            <span class="cfg-label">ظرفیت</span>
            <select class="cfg-input" onchange="updatePitch(${i},'size',parseInt(this.value))">
              <option value="5" ${p.size === 5 ? 'selected' : ''}>۵ نفره</option>
              <option value="7" ${p.size === 7 ? 'selected' : ''}>۷ نفره</option>
              <option value="11" ${p.size === 11 ? 'selected' : ''}>۱۱ نفره</option>
            </select>
          </div>
        </div>
        <div class="cfg-row">
          <span class="cfg-label">آدرس</span>
          <input class="cfg-input" style="font-size:12px" value="${p.address}"
            oninput="updatePitch(${i},'address',this.value)">
        </div>
        <div class="cfg-row">
          <span class="cfg-label">تگ‌ها (با کاما جدا کن)</span>
          <input class="cfg-input" style="font-size:12px" value="${(p.tags || []).join('، ')}"
            oninput="updatePitch(${i},'tags',this.value.split(/[،,]/).map(t=>t.trim()).filter(Boolean))">
        </div>
        <div class="cfg-row">
          <span class="cfg-label">💰 کمیسیون ثابت سانس‌چی (تومان / هر رزرو)</span>
          <input class="cfg-input price-inp" type="number" step="10000" min="0"
            value="${p.commissionAmount || 0}" id="inp-commission-${i}"
            oninput="updatePitch(${i},'commissionAmount',parseInt(this.value)||0)"
            style="color:var(--amber);font-weight:700;direction:ltr;text-align:right">
          <span style="font-size:10px;color:var(--muted);margin-top:3px;display:block">
            مشتری کل قیمت سانس رو می‌پرده — این مبلغ سهم سانس‌چی از هر رزرو پرداخت‌شده‌ست
          </span>
        </div>
        <div class="cfg-row">
          <input type="file" accept="image/*" id="pimg-${i}" style="display:none" onchange="handlePitchImage(${i}, event)">
          <button class="cfg-input pimg-btn" onclick="document.getElementById('pimg-${i}').click()">🖼️ آپلود/تغییر عکس زمین</button>
        </div>
        <div class="cfg-row">
          <button class="cfg-input" style="cursor:pointer;text-align:center;background:var(--green-glow);color:var(--green);border-color:var(--green-border)"
            onclick="goEditPrices(${i})">⏰ ویرایش قیمت سانس‌های این زمین</button>
        </div>
      </div>

      <div class="pcfg-slots">
        <div class="pcfg-slots-title">
          <span>وضعیت سانس‌ها — کلیک برای رزرو/آزاد کردن</span>
          <span id="avail-count-${i}" style="color:var(--green);font-size:11px">
            ${numFa(p.takenSlots.filter((t) => !t).length)} خالی
          </span>
        </div>
        <div class="slots-mini" id="slots-mini-${i}"></div>
      </div>

      <div class="pcfg-footer">
        <button class="pcfg-save-btn" onclick="savePitch(${i})">✓ اعمال تغییرات این زمین</button>
        <button class="pcfg-reset-btn" onclick="resetPitch(${i})" title="برگشت به آخرین نسخهٔ سرور">↺</button>
        <span class="saved-badge" id="saved-badge-${i}">✓ ذخیره شد</span>
      </div>
    </div>
  `,
    )
    .join('');

  STATE.pitches.forEach((_, i) => updateSlotMinis(i));
}

function goEditPrices(i) {
  STATE.selectedPitchIdx = i;
  showPanel('slots');
  renderPitchSelector();
  renderSlotsTable();
}
window.goEditPrices = goEditPrices;

function updateSlotMinis(i) {
  const p = STATE.pitches[i];
  const container = document.getElementById('slots-mini-' + i);
  const countEl = document.getElementById('avail-count-' + i);
  if (!container || !p) return;

  container.innerHTML = STATE.slots
    .map((s, si) => {
      const taken = p.takenSlots[si] || false;
      const peak = (p.slotPrices[si] || 0) >= 700000;
      const cls = taken
        ? 'slot-mini taken'
        : peak
          ? 'slot-mini peak'
          : 'slot-mini';
      const label = taken ? '🔴' : peak ? '🟡' : '🟢';
      return `<div class="${cls}" onclick="toggleSlot(${i},${si})" title="${s.time}">
      ${label} ${numFa(si + 1)}
    </div>`;
    })
    .join('');

  if (countEl)
    countEl.textContent =
      numFa(p.takenSlots.filter((t) => !t).length) + ' خالی';
}

function toggleSlot(pitchIdx, slotIdx) {
  STATE.pitches[pitchIdx].takenSlots[slotIdx] =
    !STATE.pitches[pitchIdx].takenSlots[slotIdx];
  updateSlotMinis(pitchIdx);
  markDirty();
}
window.toggleSlot = toggleSlot;

function updatePitch(i, key, val) {
  STATE.pitches[i][key] = val;
  if (key === 'name') {
    const nameEl = document.getElementById('pcfg-name-' + i);
    if (nameEl) nameEl.textContent = val;
    renderPitchSelector();
  }
  const card = document.getElementById('pitch-card-' + i);
  if (card) card.classList.add('dirty');
  markDirty();
}
window.updatePitch = updatePitch;

function toggleActive(i) {
  STATE.pitches[i].isActive = !STATE.pitches[i].isActive;
  const btn = document.getElementById('toggle-' + i);
  btn.classList.toggle('on', STATE.pitches[i].isActive);
  btn.title = STATE.pitches[i].isActive
    ? 'فعال (کلیک برای غیرفعال)'
    : 'غیرفعال (کلیک برای فعال)';
  markDirty();
  toast(
    STATE.pitches[i].isActive
      ? 'زمین فعال شد — یادت نره ذخیره کنی!'
      : 'زمین غیرفعال شد — یادت نره ذخیره کنی!',
  );
}
window.toggleActive = toggleActive;

// ═══════════════════════════════════════════
// SAVE / RESET — اتصال واقعی به بک‌اند
// ═══════════════════════════════════════════
async function savePitch(i) {
  const p = STATE.pitches[i];
  if (!p) return;
  const card = document.getElementById('pitch-card-' + i);
  if (card) card.classList.remove('dirty');
  setSaveStatus('saving');

  try {
    const slots = STATE.slots.map((s, si) => ({
      time: s.time,
      price: p.slotPrices[si],
      taken: p.takenSlots[si] || false,
    }));

    const res = await fetch(`${API}/pitches/${p.id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({
        name: p.name,
        type: p.type,
        size: p.size,
        isActive: p.isActive,
        address: p.address,
        tags: p.tags,
        image: p.image || '',
        commissionAmount: p.commissionAmount || 0,
        slots,
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'خطای نامشخص');

    toast('✓ زمین «' + p.name + '» روی سرور ذخیره شد');
    setSaveStatus('saved');
  } catch (e) {
    toast('❌ خطا در ذخیره: ' + e.message, true);
    setSaveStatus('');
  }

  const badge = document.getElementById('saved-badge-' + i);
  if (badge) {
    badge.classList.add('show');
    setTimeout(() => badge.classList.remove('show'), 2000);
  }
}
window.savePitch = savePitch;

async function resetPitch(i) {
  if (!confirm('تغییرات این زمین از آخرین نسخهٔ سرور برگردونده بشه؟')) return;
  await initAdminData();
  toast('↺ برگشت به آخرین نسخهٔ سرور');
}
window.resetPitch = resetPitch;

// ═══════════════════════════════════════════
// EXPORT (فقط نمایشی / پشتیبان)
// ═══════════════════════════════════════════
function buildExport() {
  const pitchesCode = STATE.pitches
    .map((p) => {
      const avail = p.takenSlots.filter((t) => !t).length;
      return `زمین: ${p.name} (${p.id})
  نوع: ${typeShort[p.type]} | ظرفیت: ${p.size} | فعال: ${p.isActive}
  آدرس: ${p.address}
  سانس‌های خالی: ${avail} از ${STATE.slots.length}
  قیمت‌ها: ${p.slotPrices.join(', ')}
`;
    })
    .join('\n');

  document.getElementById('exportCode').textContent =
    `// وضعیت فعلی زمین‌ها (آخرین بار از سرور خونده‌شده)\n// ${new Date().toLocaleString('fa-IR')}\n\n` +
    pitchesCode;
}
window.buildExport = buildExport;

function copyExport() {
  const code = document.getElementById('exportCode').textContent;
  navigator.clipboard.writeText(code).then(() => toast('✓ کد کپی شد!'));
}
window.copyExport = copyExport;

// ═══════════════════════════════════════════
// RESERVATIONS PANEL
// ═══════════════════════════════════════════

// بارگذاری همهٔ رزروها از سرور (فقط ادمین به این مسیر دسترسی دارد)
async function loadAdminReservations() {
  const tbody = document.getElementById('reservationsTableBody');
  if (tbody)
    tbody.innerHTML =
      '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--muted)">در حال بارگذاری رزروها...</td></tr>';
  try {
    const res = await fetch(`${API}/reservations`, {
      headers: authHeaders(),
    });
    if (res.status === 401 || res.status === 403) {
      goToAdminLogin(
        '⚠️ نشست منقضی شده یا دسترسی ادمین نداری — دوباره وارد شو',
      );
      return;
    }
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'خطا در دریافت رزروها');
    STATE.reservations = data.reservations || [];
    toast('✓ رزروها بارگذاری شد');
  } catch (e) {
    STATE.reservations = [];
    toast('❌ خطا در دریافت رزروها: ' + (e.message || 'نامشخص'), true);
  }
  populateResPitchFilter();
  renderAdminReservations();
}
window.loadAdminReservations = loadAdminReservations;

// پر کردن گزینه‌های فیلتر «زمین» از روی رزروهای موجود
function populateResPitchFilter() {
  const sel = document.getElementById('resPitchFilter');
  if (!sel) return;
  const current = sel.value;
  const seen = new Map();
  STATE.reservations.forEach((r) => {
    const p = r.pitch;
    if (p && p._id && !seen.has(p._id)) seen.set(p._id, p.name || '—');
  });
  sel.innerHTML =
    '<option value="">همه زمین‌ها</option>' +
    [...seen.entries()]
      .map(([id, name]) => `<option value="${id}">${name}</option>`)
      .join('');
  if (current && seen.has(current)) sel.value = current;
}

function renderAdminReservations() {
  const tbody = document.getElementById('reservationsTableBody');
  if (!tbody) return;

  const statusFilter = document.getElementById('resStatusFilter')?.value || '';
  const pitchFilter = document.getElementById('resPitchFilter')?.value || '';

  let list = STATE.reservations;
  if (statusFilter) list = list.filter((r) => r.status === statusFilter);
  if (pitchFilter)
    list = list.filter((r) => r.pitch && r.pitch._id === pitchFilter);

  const stMap = {
    pending: { label: '⏳ در انتظار پرداخت', cls: 'normal' },
    paid: { label: '✅ پرداخت‌شده', cls: 'peak' },
    cancelled: { label: '❌ لغو شده', cls: 'cancelled' },
  };

  // خلاصه مالی همیشه نشون بده
  renderAdminResSummary(list);

  if (!list.length) {
    tbody.innerHTML =
      '<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--muted)">رزروی پیدا نشد</td></tr>';
    return;
  }

  // جدیدترین رزروها بالا
  list = [...list].sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
  );

  tbody.innerHTML = list
    .map((r) => {
      const u = r.user || {};
      const p = r.pitch || {};
      const st = stMap[r.status] || stMap.pending;

      const commissionCell =
        r.status === 'paid'
          ? '<span style="color:var(--amber);font-weight:700">' +
            priceFa(r.siteCommission || 0) +
            ' ت</span>'
          : r.status === 'pending'
            ? '<span style="color:var(--muted);font-size:11px">پس از پرداخت</span>'
            : '<span style="color:var(--muted)">—</span>';

      const netCell =
        r.status === 'paid'
          ? '<span style="color:var(--green);font-weight:700">' +
            priceFa(r.pitchAmount || 0) +
            ' ت</span>'
          : '<span style="color:var(--muted)">—</span>';

      let actions = '<span style="color:var(--muted);font-size:12px">—</span>';
      if (r.status === 'pending') {
        actions = `
          <button class="bulk-apply" onclick="adminSetResStatus('${r._id}','paid')">تایید پرداخت</button>
          <button class="bulk-apply" style="background:rgba(239,68,68,.1);color:var(--red);border-color:rgba(239,68,68,.25);margin-right:6px" onclick="adminSetResStatus('${r._id}','cancelled')">لغو</button>`;
      } else if (r.status === 'paid') {
        actions = `<button class="bulk-apply" style="background:rgba(239,68,68,.1);color:var(--red);border-color:rgba(239,68,68,.25)" onclick="adminSetResStatus('${r._id}','cancelled')">لغو رزرو</button>`;
      }

      return `<tr>
        <td>${u.name || '—'}<br><span style="font-size:11px;color:var(--muted)">${u.phone || ''}</span></td>
        <td>${p.name || '—'}</td>
        <td>${r.date || '—'}</td>
        <td>${r.slotTime || '—'}</td>
        <td style="color:var(--text);font-weight:700;white-space:nowrap">${priceFa(r.amount)} ت</td>
        <td>${commissionCell}</td>
        <td>${netCell}</td>
        <td><span class="peak-tag ${st.cls}">${st.label}</span></td>
        <td>${actions}</td>
      </tr>`;
    })
    .join('');
}
window.renderAdminReservations = renderAdminReservations;

// ── خلاصه مالی ادمین ──
function renderAdminResSummary(list) {
  let el = document.getElementById('adminResSummary');
  if (!el) {
    el = document.createElement('div');
    el.id = 'adminResSummary';
    el.style.marginBottom = '14px';
    const tw = document.querySelector('#panel-reservations .slots-table-wrap');
    if (tw) tw.parentNode.insertBefore(el, tw);
  }
  const paid = list.filter((r) => r.status === 'paid');
  const gross = paid.reduce((s, r) => s + (r.amount || 0), 0);
  const commission = paid.reduce((s, r) => s + (r.siteCommission || 0), 0);
  const net = paid.reduce((s, r) => s + (r.pitchAmount || 0), 0);
  el.innerHTML = `
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">
            <div style="background:var(--card);border:1px solid var(--green-border);border-radius:10px;padding:14px;text-align:center">
              <div style="font-size:10px;color:var(--muted);font-weight:700;margin-bottom:6px">✅ رزرو پرداختی</div>
              <div style="font-size:22px;font-weight:900;color:var(--green)">${numFa(paid.length)}</div>
              <div style="font-size:10px;color:var(--muted)">عدد</div>
            </div>
            <div style="background:var(--card);border:1px solid var(--green-border);border-radius:10px;padding:14px;text-align:center">
              <div style="font-size:10px;color:var(--muted);font-weight:700;margin-bottom:6px">💰 کل درآمد ناخالص</div>
              <div style="font-size:18px;font-weight:900;color:var(--text)">${priceFa(gross)}</div>
              <div style="font-size:10px;color:var(--muted)">تومان</div>
            </div>
            <div style="background:var(--card);border:1px solid rgba(245,158,11,.25);border-radius:10px;padding:14px;text-align:center">
              <div style="font-size:10px;color:var(--muted);font-weight:700;margin-bottom:6px">🏷️ کمیسیون سانس‌چی</div>
              <div style="font-size:18px;font-weight:900;color:var(--amber)">${priceFa(commission)}</div>
              <div style="font-size:10px;color:var(--muted)">تومان</div>
            </div>
            <div style="background:var(--card);border:1px solid var(--green-border);border-radius:10px;padding:14px;text-align:center">
              <div style="font-size:10px;color:var(--muted);font-weight:700;margin-bottom:6px">💸 سود خالص اونرها</div>
              <div style="font-size:18px;font-weight:900;color:var(--green)">${priceFa(net)}</div>
              <div style="font-size:10px;color:var(--muted)">تومان</div>
            </div>
          </div>`;
}

// تأیید پرداخت یا لغو یک رزرو (هم برای pending هم برای paid)
async function adminSetResStatus(id, status) {
  const msg =
    status === 'paid'
      ? 'پرداخت این رزرو تایید بشه؟'
      : 'این رزرو لغو بشه؟ سانس مربوطه آزاد می‌شه. (اگه پرداخت شده بود، بازگشت وجه رو خودت باید جدا هندل کنی)';
  if (!confirm(msg)) return;

  try {
    const res = await fetch(`${API}/owner/reservations/${id}/status`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'خطا');

    toast(status === 'paid' ? '✓ پرداخت تایید شد' : '✓ رزرو لغو شد');
    await loadAdminReservations();
    await initAdminData(); // وضعیت سانس‌های خالی در پنل «زمین‌ها» هم آپدیت بشه
  } catch (e) {
    toast('❌ ' + e.message, true);
  }
}
window.adminSetResStatus = adminSetResStatus;

// ═══════════════════════════════════════════
// INIT — قبل از هرچیز توکن + نقش ادمین رو واقعاً چک کن
// (فقط وجود توکن کافی نیست — باید معتبر باشه و role=admin باشه)
// ═══════════════════════════════════════════
function goToAdminLogin(msg) {
  sessionStorage.removeItem('sns_token');
  sessionStorage.removeItem('sns_user');
  toast(msg, true, 3000);
  setTimeout(() => {
    window.location.href = './login.html?redirect=admin';
  }, 1500);
}

async function verifyAdminAndInit() {
  if (!getToken()) {
    goToAdminLogin('⚠️ ابتدا با اکانت ادمین وارد شو...');
    return;
  }
  try {
    const res = await fetch(`${API}/auth/me`, { headers: authHeaders() });
    if (res.status === 401) throw new Error('expired');
    const data = await res.json();
    if (!data.success || data.user.role !== 'admin') {
      throw new Error('not-admin');
    }
    initAdminData();
  } catch (e) {
    goToAdminLogin(
      '⚠️ نشست منقضی شده یا این حساب دسترسی ادمین ندارد — دوباره وارد شو',
    );
  }
}

verifyAdminAndInit();
setSaveStatus('');

// ═══════════════════════════════════════════
// REVENUE PANEL
// ═══════════════════════════════════════════
let _revPeriod = 'all';
let _revChart = null;

function initRevenuePanel() {
  _revPeriod = 'all';
  // reset tabs
  ['all', 'day', 'week', 'month', 'year'].forEach((p) => {
    const el = document.getElementById('rev-tab-' + p);
    if (el) el.classList.toggle('active', p === 'all');
  });
  loadRevenueData();
}
window.initRevenuePanel = initRevenuePanel;

function switchRevPeriod(period) {
  _revPeriod = period;
  ['all', 'day', 'week', 'month', 'year'].forEach((p) => {
    const el = document.getElementById('rev-tab-' + p);
    if (el) el.classList.toggle('active', p === period);
  });
  loadRevenueData();
}
window.switchRevPeriod = switchRevPeriod;

// تبدیل تاریخ شمسی "1403/03/24" به Date میلادی
function jalaliToDate(str) {
  if (!str) return null;
  const parts = str.split('/');
  if (parts.length < 3) return null;
  const [jy, jm, jd] = parts.map(Number);
  // تبدیل جلالی به میلادی
  let gy = jy + 621;
  const breaks = [
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097,
    2192, 2262, 2324, 2394, 2456, 3178,
  ];
  const month_lengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let leap = false;
  let jy2 = jy - 979;
  let jm2 = jm - 1;
  let jd2 = jd - 1;
  let j_day_no =
    365 * jy2 + Math.floor(jy2 / 33) * 8 + Math.floor(((jy2 % 33) + 3) / 4);
  for (let i = 0; i < jm2; i++) j_day_no += jm2 <= 6 ? 31 : 30;
  j_day_no += jd2;
  let g_day_no = j_day_no + 79;
  let gy2 = 1600 + 400 * Math.floor(g_day_no / 146097);
  g_day_no = g_day_no % 146097;
  if (g_day_no >= 36525) {
    g_day_no--;
    gy2 += 100 * Math.floor(g_day_no / 36524);
    g_day_no = g_day_no % 36524;
    if (g_day_no >= 365) g_day_no++;
  }
  gy2 += 4 * Math.floor(g_day_no / 1461);
  g_day_no %= 1461;
  if (g_day_no >= 366) {
    leap = false;
    g_day_no--;
    gy2 += Math.floor(g_day_no / 365);
    g_day_no = g_day_no % 365;
  } else {
    leap = true;
  }
  month_lengths[1] = leap ? 29 : 28;
  let gm2 = 0;
  for (let i = 0; i < 12 && g_day_no >= month_lengths[i]; i++) {
    g_day_no -= month_lengths[i];
    gm2++;
  }
  return new Date(gy2, gm2, g_day_no + 1);
}

// محدوده تاریخ بر اساس period
function getPeriodRange(period) {
  const now = new Date();
  const start = new Date(now);
  if (period === 'all') {
    start.setFullYear(2000, 0, 1);
    start.setHours(0, 0, 0, 0);
  } else if (period === 'day') {
    start.setHours(0, 0, 0, 0);
  } else if (period === 'week') {
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
  } else if (period === 'month') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  } else if (period === 'year') {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
  }
  return { start, end: new Date(now) };
}

async function loadRevenueData() {
  // همیشه داده‌های تازه بگیر
  try {
    const res = await fetch(`${API}/reservations`, {
      headers: authHeaders(),
    });
    const data = await res.json();
    if (data.success) STATE.reservations = data.reservations || [];
  } catch (e) {
    // اگه خطا داد از همون STATE.reservations موجود استفاده کن
  }
  renderRevenuePanel(STATE.reservations);
}

function renderRevenuePanel(allReservations) {
  const { start, end } = getPeriodRange(_revPeriod);

  const filtered = allReservations.filter((r) => {
    if (_revPeriod === 'all') return true;
    const d = r.createdAt ? new Date(r.createdAt) : jalaliToDate(r.date);
    if (!d) return true;
    return d >= start && d <= end;
  });

  const paid = filtered.filter((r) => r.status === 'paid');
  const pending = filtered.filter((r) => r.status === 'pending');

  // محاسبه مالی
  const totalGross = paid.reduce((s, r) => s + (r.amount || 0), 0);
  const totalCommission = paid.reduce((s, r) => s + (r.siteCommission || 0), 0);
  const totalNet = paid.reduce((s, r) => s + (r.pitchAmount || 0), 0);

  // ── خلاصه مالی بالا ──
  document.getElementById('rev-fin-gross').textContent = priceFa(totalGross);
  document.getElementById('rev-fin-commission').textContent =
    priceFa(totalCommission);
  document.getElementById('rev-fin-commission-sub').textContent = paid.length
    ? numFa(paid.length) + ' رزرو'
    : 'تومان';
  document.getElementById('rev-fin-net').textContent = priceFa(totalNet);

  // ── متریک‌ها ──
  document.getElementById('rev-m-revenue').textContent = priceFa(totalGross);
  document.getElementById('rev-m-commission').textContent =
    priceFa(totalCommission);
  document.getElementById('rev-m-paid').textContent = numFa(paid.length);
  document.getElementById('rev-m-pending').textContent = numFa(pending.length);

  const periodLabels = {
    all: 'همه زمان‌ها',
    day: 'امروز',
    week: 'این هفته',
    month: 'این ماه',
    year: 'این سال',
  };
  document.getElementById('rev-chart-title').textContent =
    'نمودار درآمد — ' + (periodLabels[_revPeriod] || 'همه');

  renderRevenueChart(filtered, paid);
  renderPitchRevenue(paid);
  renderPitchCommissionRevenue(paid);
  renderSlotRevenue(paid);
  renderAvgCommissionByPitch(paid);
}

function renderRevenueChart(filtered, paid) {
  const canvas = document.getElementById('revChart');
  if (!canvas) return;

  let labels = [];
  let grossData = [];
  let commissionData = [];
  let pendingData = [];
  const pending = filtered.filter((r) => r.status === 'pending');

  function fillArrays(n) {
    grossData = Array(n).fill(0);
    commissionData = Array(n).fill(0);
    pendingData = Array(n).fill(0);
  }

  if (_revPeriod === 'all') {
    const jMonths = [
      'فرو',
      'ارد',
      'خرد',
      'تیر',
      'مرد',
      'شهر',
      'مهر',
      'آبان',
      'آذر',
      'دی',
      'بهمن',
      'اسف',
    ];
    labels = jMonths;
    fillArrays(12);
    paid.forEach((r) => {
      const d = r.createdAt ? new Date(r.createdAt) : jalaliToDate(r.date);
      if (d) {
        grossData[d.getMonth()] += r.amount || 0;
        commissionData[d.getMonth()] += r.siteCommission || 0;
      }
    });
    pending.forEach((r) => {
      const d = r.createdAt ? new Date(r.createdAt) : jalaliToDate(r.date);
      if (d) pendingData[d.getMonth()] += r.amount || 0;
    });
  } else if (_revPeriod === 'day') {
    labels = Array.from({ length: 18 }, (_, i) => numFa(i + 6) + ':۰۰');
    fillArrays(18);
    paid.forEach((r) => {
      const d = r.createdAt ? new Date(r.createdAt) : jalaliToDate(r.date);
      if (d) {
        const h = d.getHours() - 6;
        if (h >= 0 && h < 18) {
          grossData[h] += r.amount || 0;
          commissionData[h] += r.siteCommission || 0;
        }
      }
    });
    pending.forEach((r) => {
      const d = r.createdAt ? new Date(r.createdAt) : jalaliToDate(r.date);
      if (d) {
        const h = d.getHours() - 6;
        if (h >= 0 && h < 18) pendingData[h] += r.amount || 0;
      }
    });
  } else if (_revPeriod === 'week') {
    labels = [
      'یکشنبه',
      'دوشنبه',
      'سه‌شنبه',
      'چهارشنبه',
      'پنجشنبه',
      'جمعه',
      'شنبه',
    ];
    fillArrays(7);
    paid.forEach((r) => {
      const d = jalaliToDate(r.date) || new Date(r.createdAt);
      grossData[d.getDay()] += r.amount || 0;
      commissionData[d.getDay()] += r.siteCommission || 0;
    });
    pending.forEach((r) => {
      const d = jalaliToDate(r.date) || new Date(r.createdAt);
      pendingData[d.getDay()] += r.amount || 0;
    });
  } else if (_revPeriod === 'month') {
    const now = new Date();
    const daysInMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
    ).getDate();
    labels = Array.from({ length: daysInMonth }, (_, i) => numFa(i + 1));
    fillArrays(daysInMonth);
    paid.forEach((r) => {
      const d = jalaliToDate(r.date) || new Date(r.createdAt);
      if (d.getMonth() === now.getMonth()) {
        grossData[d.getDate() - 1] += r.amount || 0;
        commissionData[d.getDate() - 1] += r.siteCommission || 0;
      }
    });
    pending.forEach((r) => {
      const d = jalaliToDate(r.date) || new Date(r.createdAt);
      if (d.getMonth() === now.getMonth())
        pendingData[d.getDate() - 1] += r.amount || 0;
    });
  } else {
    labels = [
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
    fillArrays(12);
    paid.forEach((r) => {
      const d = jalaliToDate(r.date) || new Date(r.createdAt);
      grossData[d.getMonth()] += r.amount || 0;
      commissionData[d.getMonth()] += r.siteCommission || 0;
    });
    pending.forEach((r) => {
      const d = jalaliToDate(r.date) || new Date(r.createdAt);
      pendingData[d.getMonth()] += r.amount || 0;
    });
  }

  drawBarChart(canvas, labels, grossData, commissionData, pendingData);
}

function drawBarChart(canvas, labels, grossData, commissionData, pendingData) {
  if (!canvas.offsetWidth) {
    requestAnimationFrame(() =>
      drawBarChart(canvas, labels, grossData, commissionData, pendingData),
    );
    return;
  }
  const ctx = canvas.getContext('2d');
  const W = canvas.offsetWidth || canvas.parentElement?.offsetWidth || 600;
  const H = 200;
  canvas.width = W;
  canvas.height = H;
  ctx.clearRect(0, 0, W, H);

  const allData = [
    ...grossData,
    ...(commissionData || []),
    ...(pendingData || []),
  ];
  const maxVal = Math.max(...allData, 1);
  const padL = 10,
    padR = 10,
    padT = 20,
    padB = 30;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const n = labels.length;
  const groupW = chartW / n;
  const barW = Math.max(3, groupW * 0.25);
  const gap = Math.max(1, groupW * 0.04);

  // grid lines
  for (let i = 0; i <= 4; i++) {
    const y = padT + chartH - (chartH * i) / 4;
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(34,197,94,0.08)';
    ctx.lineWidth = 1;
    ctx.moveTo(padL, y);
    ctx.lineTo(W - padR, y);
    ctx.stroke();
  }

  // bars: gross=green, commission=amber, pending=blue
  grossData.forEach((v, i) => {
    const x = padL + i * groupW + gap;
    // gross (ناخالص)
    if (v > 0) {
      const bH = Math.max(3, (v / maxVal) * chartH);
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      if (ctx.roundRect)
        ctx.roundRect(x, padT + chartH - bH, barW, bH, [3, 3, 0, 0]);
      else ctx.rect(x, padT + chartH - bH, barW, bH);
      ctx.fill();
    }
    // commission (کمیسیون)
    const cv = (commissionData || [])[i] || 0;
    if (cv > 0) {
      const cH = Math.max(3, (cv / maxVal) * chartH);
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      if (ctx.roundRect)
        ctx.roundRect(x + barW + 2, padT + chartH - cH, barW, cH, [3, 3, 0, 0]);
      else ctx.rect(x + barW + 2, padT + chartH - cH, barW, cH);
      ctx.fill();
    }
    // pending (در انتظار)
    const pv = (pendingData || [])[i] || 0;
    if (pv > 0) {
      const pH = Math.max(3, (pv / maxVal) * chartH);
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      if (ctx.roundRect)
        ctx.roundRect(
          x + (barW + 2) * 2,
          padT + chartH - pH,
          barW,
          pH,
          [3, 3, 0, 0],
        );
      else ctx.rect(x + (barW + 2) * 2, padT + chartH - pH, barW, pH);
      ctx.fill();
    }
  });

  const step = n > 15 ? Math.ceil(n / 12) : 1;
  ctx.fillStyle = 'rgba(63,102,80,0.9)';
  ctx.font = `${Math.max(9, Math.min(11, Math.floor(groupW * 0.55)))}px Vazirmatn, sans-serif`;
  ctx.textAlign = 'center';
  labels.forEach((lbl, i) => {
    if (i % step !== 0) return;
    ctx.fillText(lbl, padL + i * groupW + groupW / 2, H - 8);
  });
}

function renderPitchRevenue(paid) {
  const el = document.getElementById('rev-pitch-list');
  if (!el) return;
  const map = {};
  paid.forEach((r) => {
    // pitch ممکنه populate نشده باشه — از STATE.pitches هم بگرد
    let name = (r.pitch && r.pitch.name) || '';
    if (!name && r.pitch && typeof r.pitch === 'string') {
      const found = STATE.pitches.find(
        (p) => p.id === r.pitch || p._id === r.pitch,
      );
      name = found ? found.name : '';
    }
    if (!name) name = 'زمین حذف‌شده';
    map[name] = (map[name] || 0) + (r.amount || 0);
  });
  const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
  const maxV = sorted[0]?.[1] || 1;
  if (!sorted.length) {
    el.innerHTML =
      '<div style="color:var(--muted);font-size:12px;text-align:center;padding:20px">داده‌ای وجود ندارد</div>';
    return;
  }
  el.innerHTML = sorted
    .map(
      ([name, v]) => `
          <div class="rev-pitch-row">
            <span class="rev-pitch-name">${name}</span>
            <div class="rev-pitch-bar-wrap"><div class="rev-pitch-bar" style="width:${Math.round((v / maxV) * 100)}%"></div></div>
            <span class="rev-pitch-val">${priceFa(v)}</span>
          </div>`,
    )
    .join('');
}

function renderSlotRevenue(paid) {
  const el = document.getElementById('rev-slot-list');
  if (!el) return;
  const map = {};
  paid.forEach((r) => {
    const t = r.slotTime || '—';
    if (!map[t]) map[t] = { count: 0, peak: (r.amount || 0) >= 700000 };
    map[t].count++;
  });
  const sorted = Object.entries(map)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8);
  if (!sorted.length) {
    el.innerHTML =
      '<div style="color:var(--muted);font-size:12px;text-align:center;padding:20px">داده‌ای وجود ندارد</div>';
    return;
  }
  el.innerHTML = sorted
    .map(
      ([time, info]) => `
          <div class="rev-slot-row">
            <span class="rev-slot-time">${time}</span>
            <span class="rev-slot-badge ${info.peak ? 'rev-badge-peak' : 'rev-badge-normal'}">${info.peak ? '🌙 اوج' : '☀️ عادی'}</span>
            <span class="rev-slot-count">${numFa(info.count)} رزرو</span>
          </div>`,
    )
    .join('');
}

// ============================================================
// SETTLEMENT MANAGEMENT (ADMIN)
// ============================================================
function adminNumFa(n) {
  return String(n ?? 0).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
}
function adminPriceFa(n) {
  return adminNumFa((parseInt(n) || 0).toLocaleString('en'));
}

function loadAdminSettlements() {
  const date = document.getElementById('settlementDateFilter').value;
  const status = document.getElementById('settlementStatusFilter').value;
  let url = API + '/settlements?';
  if (date) url += 'date=' + encodeURIComponent(date) + '&';
  if (status) url += 'status=' + encodeURIComponent(status) + '&';

  fetch(url, { headers: authHeaders() })
    .then((r) => r.json())
    .then((data) => {
      if (!data.success) throw new Error(data.message);
      renderSettlementTable(data.settlements, data.stats);
    })
    .catch((err) => {
      document.getElementById('settlementTbody').innerHTML =
        '<tr><td colspan="9" style="text-align:center;color:var(--red);padding:30px">❌ ' +
        err.message +
        '</td></tr>';
    });
}

function renderSettlementTable(settlements, stats) {
  // Stats
  const statsEl = document.getElementById('settlementStats');
  if (stats) {
    statsEl.innerHTML = `
      <div class="stat-card"><div class="stat-val">${adminPriceFa(stats.totalGross)}</div><div class="stat-lbl">ناخالص کل</div></div>
      <div class="stat-card"><div class="stat-val">${adminPriceFa(stats.totalCommission)}</div><div class="stat-lbl">کمیسیون کل</div></div>
      <div class="stat-card"><div class="stat-val">${adminPriceFa(stats.totalNet)}</div><div class="stat-lbl">خالص کل</div></div>
      <div class="stat-card"><div class="stat-val">${stats.pending}</div><div class="stat-lbl">در انتظار</div></div>
      <div class="stat-card"><div class="stat-val">${stats.approved}</div><div class="stat-lbl">تأیید شده</div></div>
      <div class="stat-card"><div class="stat-val">${stats.paid}</div><div class="stat-lbl">پرداخت شده</div></div>
    `;
  }

  const tbody = document.getElementById('settlementTbody');
  if (!settlements.length) {
    tbody.innerHTML =
      '<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:30px">هیچ تسویه‌ای یافت نشد</td></tr>';
    return;
  }

  tbody.innerHTML = settlements
    .map((s) => {
      const statusColors = {
        pending: 'var(--amber)',
        approved: 'var(--blue)',
        paid: 'var(--green)',
        rejected: 'var(--red)',
      };
      const statusLabels = {
        pending: 'در انتظار',
        approved: 'تأیید شده',
        paid: 'پرداخت شده',
        rejected: 'رد شده',
      };
      const ownerName = s.owner ? s.owner.name : '—';
      const ownerPhone = s.owner ? s.owner.phone : '';
      const pitchName = s.pitch ? s.pitch.name : '—';

      let actions = '';
      if (s.status === 'pending') {
        actions = `
        <button onclick="approveSettlement('${s._id}')" style="padding:5px 12px;background:var(--green);color:#04100a;border:none;border-radius:6px;font-family:inherit;font-size:11px;font-weight:700;cursor:pointer;margin-left:4px">✓ تأیید</button>
        <button onclick="rejectSettlement('${s._id}')" style="padding:5px 12px;background:transparent;color:var(--red);border:1px solid var(--red);border-radius:6px;font-family:inherit;font-size:11px;font-weight:700;cursor:pointer">✗ رد</button>
      `;
      } else if (s.status === 'approved') {
        actions = `
        <button onclick="paySettlement('${s._id}')" style="padding:5px 12px;background:var(--green);color:#04100a;border:none;border-radius:6px;font-family:inherit;font-size:11px;font-weight:700;cursor:pointer;margin-left:4px">💰 پرداخت شد</button>
        <button onclick="rejectSettlement('${s._id}')" style="padding:5px 12px;background:transparent;color:var(--red);border:1px solid var(--red);border-radius:6px;font-family:inherit;font-size:11px;font-weight:700;cursor:pointer">✗ رد</button>
      `;
      } else if (s.status === 'paid') {
        actions = `<span style="color:var(--green);font-size:12px">✓ پرداخت شده</span>`;
      } else {
        actions = `<span style="color:var(--muted);font-size:12px">رد شده</span>`;
      }

      return `<tr>
      <td style="font-weight:600">${pitchName}</td>
      <td>${ownerName}<br><span style="font-size:11px;color:var(--muted);direction:ltr;display:inline-block">${ownerPhone}</span></td>
      <td>${s.date}</td>
      <td style="color:var(--text);font-weight:600">${adminPriceFa(s.grossAmount)}</td>
      <td style="color:var(--amber);font-weight:600">${adminPriceFa(s.commissionAmount)}</td>
      <td style="color:var(--green);font-weight:600">${adminPriceFa(s.netAmount)}</td>
      <td style="font-size:12px">${s.paidCount} فعال / ${s.voidedCount} لغو</td>
      <td><span style="color:${statusColors[s.status] || 'var(--muted)'};font-weight:700;font-size:12px">${statusLabels[s.status] || s.status}</span></td>
      <td>${actions}</td>
    </tr>`;
    })
    .join('');
}

function approveSettlement(id) {
  if (!confirm('تأیید می‌کنید که این تسویه پرداخت شود؟')) return;
  fetch(API + '/settlements/' + id + '/approve', {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ adminNote: '' }),
  })
    .then((r) => r.json())
    .then((data) => {
      if (!data.success) throw new Error(data.message);
      toast('✓ تسویه تأیید شد');
      loadAdminSettlements();
    })
    .catch((err) => toast('❌ ' + err.message, true));
}

function paySettlement(id) {
  if (!confirm('آیا مبلغ این تسویه به صاحب زمین پرداخت شده است؟')) return;
  fetch(API + '/settlements/' + id + '/pay', {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ adminNote: '' }),
  })
    .then((r) => r.json())
    .then((data) => {
      if (!data.success) throw new Error(data.message);
      toast('✓ تسویه به عنوان پرداخت شده ثبت شد');
      loadAdminSettlements();
    })
    .catch((err) => toast('❌ ' + err.message, true));
}

function rejectSettlement(id) {
  const note = prompt('دلیل رد تسویه (اختیاری):');
  fetch(API + '/settlements/' + id + '/reject', {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ adminNote: note || '' }),
  })
    .then((r) => r.json())
    .then((data) => {
      if (!data.success) throw new Error(data.message);
      toast('✓ تسویه رد شد');
      loadAdminSettlements();
    })
    .catch((err) => toast('❌ ' + err.message, true));
}

// ============================================================
// OWNER MANAGEMENT (ADMIN)
// ============================================================
function loadOwnerManagement() {
  // Load pitches for select
  fetch(API + '/pitches', { headers: authHeaders() })
    .then((r) => r.json())
    .then((data) => {
      if (!data.success) throw new Error(data.message);
      const select = document.getElementById('ownerPitchSelect');
      select.innerHTML =
        '<option value="">انتخاب زمین...</option>' +
        data.pitches
          .map(
            (p) =>
              '<option value="' +
              p._id +
              '">' +
              p.name +
              ' (' +
              p.type +
              ', ' +
              p.size +
              ' نفره)</option>',
          )
          .join('');
    })
    .catch((err) => toast('❌ ' + err.message, true));

  // Load owner table
  fetch(API + '/owner/pitches', { headers: authHeaders() })
    .then((r) => r.json())
    .then((data) => {
      if (!data.success) throw new Error(data.message);
      renderOwnerTable(data.pitches);
    })
    .catch((err) => {
      document.getElementById('ownerTbody').innerHTML =
        '<tr><td colspan="5" style="text-align:center;color:var(--red);padding:30px">❌ ' +
        err.message +
        '</td></tr>';
    });
}

function renderOwnerTable(pitches) {
  const tbody = document.getElementById('ownerTbody');
  if (!pitches.length) {
    tbody.innerHTML =
      '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:30px">هیچ زمینی یافت نشد</td></tr>';
    return;
  }

  tbody.innerHTML = pitches
    .map((p) => {
      const hasOwner = p.owner && p.owner._id;
      return `<tr>
      <td style="font-weight:600">${p.name}</td>
      <td>${p.type === 'futsal' ? 'فوتسال' : 'چمن'} - ${p.size} نفره</td>
      <td>${hasOwner ? p.owner.name : '<span style="color:var(--muted)">بدون صاحب</span>'}</td>
      <td style="direction:ltr">${hasOwner ? p.owner.phone : '—'}</td>
      <td>${hasOwner ? '<span style="color:var(--green);font-size:12px">✓ متصل</span>' : '<span style="color:var(--amber);font-size:12px">● بدون صاحب</span>'}</td>
    </tr>`;
    })
    .join('');
}

function assignOwner() {
  const pitchId = document.getElementById('ownerPitchSelect').value;
  const phone = document.getElementById('ownerPhoneInput').value.trim();

  if (!pitchId) {
    toast('❌ لطفاً یک زمین انتخاب کنید', true);
    return;
  }
  if (!phone) {
    toast('❌ لطفاً شماره موبایل را وارد کنید', true);
    return;
  }

  fetch(API + '/pitches/' + pitchId + '/assign-owner', {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ phone }),
  })
    .then((r) => r.json())
    .then((data) => {
      if (!data.success) throw new Error(data.message);
      document.getElementById('ownerResult').innerHTML =
        '<div style="color:var(--green);padding:10px;background:var(--glow);border-radius:8px">✅ ' +
        data.message +
        '</div>';
      document.getElementById('ownerPhoneInput').value = '';
      loadOwnerManagement();
    })
    .catch((err) => {
      document.getElementById('ownerResult').innerHTML =
        '<div style="color:var(--red);padding:10px;background:rgba(239,68,68,0.1);border-radius:8px">❌ ' +
        err.message +
        '</div>';
    });
}

function removeOwner() {
  const pitchId = document.getElementById('ownerPitchSelect').value;
  if (!pitchId) {
    toast('❌ لطفاً یک زمین انتخاب کنید', true);
    return;
  }
  if (!confirm('آیا مطمئن هستید؟ مالک این زمین حذف خواهد شد.')) return;

  fetch(API + '/pitches/' + pitchId + '/remove-owner', {
    method: 'DELETE',
    headers: authHeaders(),
  })
    .then((r) => r.json())
    .then((data) => {
      if (!data.success) throw new Error(data.message);
      document.getElementById('ownerResult').innerHTML =
        '<div style="color:var(--green);padding:10px;background:var(--glow);border-radius:8px">✅ ' +
        data.message +
        '</div>';
      loadOwnerManagement();
    })
    .catch((err) => {
      document.getElementById('ownerResult').innerHTML =
        '<div style="color:var(--red);padding:10px;background:rgba(239,68,68,0.1);border-radius:8px">❌ ' +
        err.message +
        '</div>';
    });
}

// Add stat-card styles
(function () {
  const style = document.createElement('style');
  style.textContent = `
    .stat-card {
      background: var(--card);
      border: 1px solid var(--green-border);
      border-radius: 12px;
      padding: 16px 20px;
      text-align: center;
    }
    .stat-val {
      font-size: 20px;
      font-weight: 900;
      color: var(--text);
    }
    .stat-lbl {
      font-size: 11px;
      color: var(--muted);
      margin-top: 4px;
    }
  `;
  document.head.appendChild(style);
})();

// Make functions globally accessible
window.loadAdminSettlements = loadAdminSettlements;
window.renderSettlementTable = renderSettlementTable;
window.approveSettlement = approveSettlement;
window.paySettlement = paySettlement;
window.rejectSettlement = rejectSettlement;
window.loadOwnerManagement = loadOwnerManagement;
window.renderOwnerTable = renderOwnerTable;
window.assignOwner = assignOwner;
window.removeOwner = removeOwner;

// ── DATA RESET ──
async function resetData(type) {
  const labels = {
    reservations: 'همه رزروها',
    settlements: 'همه تسویه‌ها',
    all: 'همه داده‌ها (رزرو + تسویه + دسترسی روزانه)',
  };
  const label = labels[type] || type;
  if (
    !confirm(
      `⚠️ آیا مطمئن هستی؟\n\n${label} پاک خواهند شد.\n\nاین عمل برگشت‌ناپذیر است!`,
    )
  )
    return;
  if (
    type === 'all' &&
    !confirm('تأیید نهایی: تمام داده‌های عملیاتی پاک خواهد شد. ادامه می‌دهی؟')
  )
    return;

  try {
    const res = await fetch(API + '/admin/reset', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ type }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    toast('✅ ' + (data.message || 'داده‌ها پاک شدند'));
    if (typeof loadAdminReservations === 'function') loadAdminReservations();
  } catch (err) {
    toast('❌ ' + err.message, true);
  }
}
window.resetData = resetData;
