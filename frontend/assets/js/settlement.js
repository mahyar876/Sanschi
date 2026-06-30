// ═══════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════
const API = 'http://localhost:5000/api';
const token = sessionStorage.getItem('sns_token');
const userRaw = sessionStorage.getItem('sns_user');
const user = userRaw ? JSON.parse(userRaw) : null;
const isAdmin = user && user.role === 'admin';

if (!token || !user) {
  window.location.href =
    './login.html?redirect=' + (isAdmin ? 'admin' : 'owner');
}

// ── helpers ──
const numFa = (n) => String(n ?? 0).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
const priceFa = (n) => numFa((parseInt(n) || 0).toLocaleString('en'));

let toastT;
function toast(msg, isErr) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isErr ? ' err' : '');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 2800);
}

function authH() {
  return {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + token,
  };
}

function todayJalali() {
  // تاریخ تقریبی شمسی امروز (برای پیش‌فرض فیلد)
  const d = new Date();
  const y = d.getFullYear() - 621;
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}/${String(m).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
}

const STATUS_MAP = {
  pending: { label: '⏳ در انتظار', cls: 'pending' },
  approved: { label: '✅ تأیید‌شده', cls: 'approved' },
  paid: { label: '💸 پرداخت‌شده', cls: 'paid' },
  rejected: { label: '❌ رد‌شده', cls: 'rejected' },
};

// ═══════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════
function initPage() {
  // role tag
  const roleTag = document.getElementById('roleTag');
  roleTag.textContent = isAdmin ? '👑 ادمین' : '🏟️ صاحب زمین';
  roleTag.className = 'role-tag ' + (isAdmin ? 'admin' : 'owner');

  // back button
  document.getElementById('backBtn').href = isAdmin
    ? './admin.html'
    : './owner.html';

  // page sub
  document.getElementById('pageSub').textContent = isAdmin
    ? 'مدیریت تسویه مالی با صاحبان زمین — تأیید، رد یا پرداخت درخواست‌ها'
    : 'وضعیت تسویه درآمد شما با سانس‌چی — پس از کسر کمیسیون';

  // admin-only UI
  if (isAdmin) {
    document.getElementById('commissionBanner').style.display = 'flex';
    document.getElementById('generateBar').style.display = 'flex';
    document.getElementById('genDateInp').value = todayJalali();
  }

  // table head
  const thead = document.getElementById('tableHead');
  if (isAdmin) {
    thead.innerHTML = `<tr>
            <th>تاریخ</th>
            <th>صاحب زمین</th>
            <th>زمین</th>
            <th>ناخالص</th>
            <th>کمیسیون</th>
            <th>خالص</th>
            <th>وضعیت</th>
            <th style="width:180px">عملیات</th>
          </tr>`;
  } else {
    thead.innerHTML = `<tr>
            <th>تاریخ</th>
            <th>زمین</th>
            <th>ناخالص</th>
            <th>کمیسیون</th>
            <th>خالص شما</th>
            <th>وضعیت</th>
            <th>جزئیات</th>
          </tr>`;
  }

  loadSettlements();
  if (isAdmin) loadCommissionSummary();
}

// ═══════════════════════════════════════════
// LOAD SETTLEMENTS
// ═══════════════════════════════════════════
let _settlements = [];

async function loadSettlements() {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML =
    '<tr class="loading-row"><td colspan="8"><div class="spinner-sm"></div> در حال بارگذاری...</td></tr>';

  try {
    const status = document.getElementById('filterStatus').value;
    const date = document.getElementById('filterDate').value.trim();

    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (date) params.set('date', date);

    const url = isAdmin
      ? `${API}/settlements?${params}`
      : `${API}/settlements/my?${params}`;

    const res = await fetch(url, { headers: authH() });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);

    _settlements = data.settlements || [];
    renderTable(_settlements);
    updateMetrics(data.stats || {});
  } catch (err) {
    tbody.innerHTML = `<tr class="loading-row"><td colspan="8" style="color:var(--red)">❌ ${err.message || 'خطا در بارگذاری'}</td></tr>`;
  }
}

function resetFilter() {
  document.getElementById('filterStatus').value = '';
  document.getElementById('filterDate').value = '';
  loadSettlements();
}
window.resetFilter = resetFilter;

// ─────────────────────────────────────
function renderTable(list) {
  const tbody = document.getElementById('tableBody');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="8">
            <div class="empty-state"><span class="ei">💼</span>هیچ تسویه‌ای پیدا نشد</div>
          </td></tr>`;
    return;
  }

  tbody.innerHTML = list
    .map((s, idx) => {
      const st = STATUS_MAP[s.status] || STATUS_MAP.pending;
      const pitchName = (s.pitch && s.pitch.name) || '—';
      const ownerName = (s.owner && s.owner.name) || '—';
      const ownerPhone = (s.owner && s.owner.phone) || '';

      let actions = '';
      if (isAdmin) {
        if (s.status === 'pending') {
          actions = `
                <button class="action-btn approve" onclick="openApproveModal(${idx})">تأیید</button>
                <button class="action-btn pay"     onclick="openPayModal(${idx})">پرداخت</button>
                <button class="action-btn reject"  onclick="openRejectModal(${idx})">رد</button>`;
        } else if (s.status === 'approved') {
          actions = `
                <button class="action-btn pay"    onclick="openPayModal(${idx})">پرداخت</button>
                <button class="action-btn reject" onclick="openRejectModal(${idx})">رد</button>`;
        } else {
          actions = `<button class="action-btn secondary" style="background:transparent;color:var(--muted);border-color:var(--border)" onclick="openDetailModal(${idx})">جزئیات</button>`;
        }
      } else {
        actions = `<button class="action-btn secondary" style="background:var(--glow);color:var(--green);border-color:var(--border)" onclick="openDetailModal(${idx})">مشاهده</button>`;
      }

      if (isAdmin) {
        return `<tr>
              <td>${s.date || '—'}</td>
              <td class="td-name">${ownerName}<span>${ownerPhone}</span></td>
              <td>${pitchName}</td>
              <td class="td-amount">${priceFa(s.grossAmount)} ت</td>
              <td class="td-amount amber">${priceFa(s.commissionAmount)} ت<span style="font-size:10px;color:var(--muted)"> (${numFa(s.commissionRate)}٪)</span></td>
              <td class="td-amount green">${priceFa(s.netAmount)} ت</td>
              <td><span class="badge ${st.cls}">${st.label}</span></td>
              <td><div class="actions">${actions}</div></td>
            </tr>`;
      } else {
        return `<tr>
              <td>${s.date || '—'}</td>
              <td>${pitchName}</td>
              <td class="td-amount">${priceFa(s.grossAmount)} ت</td>
              <td class="td-amount red">−${priceFa(s.commissionAmount)} ت</td>
              <td class="td-amount green">${priceFa(s.netAmount)} ت</td>
              <td><span class="badge ${st.cls}">${st.label}</span></td>
              <td><div class="actions">${actions}</div></td>
            </tr>`;
      }
    })
    .join('');
}

// ─────────────────────────────────────
function updateMetrics(stats) {
  document.getElementById('m-gross').textContent = priceFa(
    stats.totalGross || 0,
  );
  document.getElementById('m-pending').textContent = numFa(stats.pending || 0);
  document.getElementById('m-approved').textContent = numFa(
    stats.approved || 0,
  );
  document.getElementById('m-paid').textContent = numFa(stats.paid || 0);
}

// ═══════════════════════════════════════════
// COMMISSION SUMMARY (admin)
// ═══════════════════════════════════════════
async function loadCommissionSummary() {
  try {
    const res = await fetch(`${API}/settlements/summary`, {
      headers: authH(),
    });
    const data = await res.json();
    if (!data.success) return;

    document.getElementById('commissionRateInp').value =
      data.commissionRate || 10;
    document.getElementById('totalCommission').textContent = priceFa(
      data.byStatus.paid?.commission || 0,
    );
    document.getElementById('totalNetPaid').textContent = priceFa(
      data.byStatus.paid?.net || 0,
    );
  } catch (e) {}
}

function saveCommissionRate() {
  const rate = document.getElementById('commissionRateInp').value;
  // در یه پروژه واقعی این رو به API ارسال می‌کنی
  // اینجا فقط نمایش
  toast(`✓ نرخ کمیسیون ${numFa(rate)}٪ ذخیره شد (نیاز به endpoint سرور دارد)`);
}
window.saveCommissionRate = saveCommissionRate;

// ═══════════════════════════════════════════
// GENERATE
// ═══════════════════════════════════════════
async function generateSettlements() {
  const fromDate = document.getElementById('genFromDateInp').value.trim();
  const toDate = document.getElementById('genToDateInp').value.trim();
  if (!fromDate || !toDate) {
    toast('از تاریخ و تا تاریخ را وارد کن', true);
    return;
  }

  const btn = document.querySelector('.gen-btn');
  btn.disabled = true;
  btn.textContent = '⏳ در حال ارسال...';

  try {
    const res = await fetch(`${API}/settlements/request`, {
      method: 'POST',
      headers: authH(),
      body: JSON.stringify({ fromDate, toDate }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    toast(`✓ ${numFa(data.created?.length || 0)} درخواست ثبت شد`);
    loadSettlements();
    loadCommissionSummary();
  } catch (err) {
    toast('❌ ' + err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = '📤 ارسال درخواست تسویه';
  }
}
window.generateSettlements = generateSettlements;

// ═══════════════════════════════════════════
// MODALS
// ═══════════════════════════════════════════
let _activeIdx = null;

function openDetailModal(idx) {
  const s = _settlements[idx];
  if (!s) return;
  _activeIdx = idx;
  const st = STATUS_MAP[s.status] || STATUS_MAP.pending;

  document.getElementById('modalTitle').textContent = `تسویه ${s.date || ''}`;
  document.getElementById('modalNoteWrap').style.display = 'none';

  const rows = [
    ['زمین', (s.pitch && s.pitch.name) || '—'],
    ['تاریخ', s.date || '—'],
    ['رزروهای شامل', numFa((s.reservations || []).length) + ' رزرو', ''],
    ['ناخالص', priceFa(s.grossAmount) + ' تومان', 'green'],
    [
      'کمیسیون سانس‌چی',
      `${priceFa(s.commissionAmount)} تومان (${numFa(s.commissionRate)}٪)`,
      'amber',
    ],
    ['خالص پرداختی', priceFa(s.netAmount) + ' تومان', 'green'],
    ['وضعیت', `<span class="badge ${st.cls}">${st.label}</span>`, ''],
  ];
  if (s.adminNote) rows.push(['یادداشت', s.adminNote, '']);
  if (s.paidAt)
    rows.push([
      'تاریخ پرداخت',
      new Date(s.paidAt).toLocaleDateString('fa-IR'),
      '',
    ]);

  document.getElementById('modalRows').innerHTML = rows
    .map(
      ([l, v, cls]) =>
        `<div class="modal-row"><span class="ml">${l}</span><span class="mr ${cls || ''}">${v}</span></div>`,
    )
    .join('');

  // لیست رزروها
  const resList = document.getElementById('modalResList');
  if (s.reservations && s.reservations.length) {
    resList.style.display = 'block';
    resList.innerHTML = s.reservations
      .map((r) => {
        if (typeof r === 'object') {
          return `<div class="res-mini-item">
                <span class="code">${r.code || '—'}</span>
                <span>${r.date || ''} ${r.slotTime || ''}</span>
                <span style="color:var(--green)">${priceFa(r.amount || 0)} ت</span>
              </div>`;
        }
        return `<div class="res-mini-item"><span style="color:var(--muted)">${r}</span></div>`;
      })
      .join('');
  } else {
    resList.style.display = 'none';
  }

  document.getElementById('modalActions').innerHTML =
    `<button class="modal-btn secondary" onclick="closeModal()">بستن</button>`;

  document.getElementById('detailModal').classList.add('open');
}
window.openDetailModal = openDetailModal;

function openApproveModal(idx) {
  const s = _settlements[idx];
  if (!s) return;
  _activeIdx = idx;

  document.getElementById('modalTitle').textContent = 'تأیید تسویه';
  document.getElementById('modalResList').style.display = 'none';
  document.getElementById('modalNoteWrap').style.display = 'block';
  document.getElementById('modalNote').value = '';

  document.getElementById('modalRows').innerHTML = `
          <div class="modal-row"><span class="ml">زمین</span><span class="mr">${(s.pitch && s.pitch.name) || '—'}</span></div>
          <div class="modal-row"><span class="ml">تاریخ</span><span class="mr">${s.date || '—'}</span></div>
          <div class="modal-row"><span class="ml">خالص پرداختی</span><span class="mr green">${priceFa(s.netAmount)} تومان</span></div>
        `;

  document.getElementById('modalActions').innerHTML = `
          <button class="modal-btn secondary" onclick="closeModal()">انصراف</button>
          <button class="modal-btn primary" onclick="doApprove()">✓ تأیید تسویه</button>
        `;

  document.getElementById('detailModal').classList.add('open');
}
window.openApproveModal = openApproveModal;

function openPayModal(idx) {
  const s = _settlements[idx];
  if (!s) return;
  _activeIdx = idx;

  document.getElementById('modalTitle').textContent = 'اعلام پرداخت';
  document.getElementById('modalResList').style.display = 'none';
  document.getElementById('modalNoteWrap').style.display = 'block';
  document.getElementById('modalNote').value = '';

  const ownerName = (s.owner && s.owner.name) || '—';
  document.getElementById('modalRows').innerHTML = `
          <div class="modal-row"><span class="ml">دریافت‌کننده</span><span class="mr">${ownerName}</span></div>
          <div class="modal-row"><span class="ml">زمین</span><span class="mr">${(s.pitch && s.pitch.name) || '—'}</span></div>
          <div class="modal-row"><span class="ml">تاریخ تسویه</span><span class="mr">${s.date || '—'}</span></div>
          <div class="modal-row"><span class="ml">مبلغ پرداختی</span><span class="mr green">${priceFa(s.netAmount)} تومان</span></div>
        `;

  document.getElementById('modalActions').innerHTML = `
          <button class="modal-btn secondary" onclick="closeModal()">انصراف</button>
          <button class="modal-btn primary" onclick="doPay()">💸 تأیید پرداخت</button>
        `;

  document.getElementById('detailModal').classList.add('open');
}
window.openPayModal = openPayModal;

function openRejectModal(idx) {
  const s = _settlements[idx];
  if (!s) return;
  _activeIdx = idx;

  document.getElementById('modalTitle').textContent = 'رد تسویه';
  document.getElementById('modalResList').style.display = 'none';
  document.getElementById('modalNoteWrap').style.display = 'block';
  document.getElementById('modalNote').value = '';

  document.getElementById('modalRows').innerHTML = `
          <div class="modal-row"><span class="ml">زمین</span><span class="mr">${(s.pitch && s.pitch.name) || '—'}</span></div>
          <div class="modal-row"><span class="ml">خالص</span><span class="mr red">${priceFa(s.netAmount)} تومان</span></div>
          <div style="padding:10px 0;font-size:12px;color:var(--muted)">⚠️ رد کردن تسویه برگشت‌پذیر نیست.</div>
        `;

  document.getElementById('modalActions').innerHTML = `
          <button class="modal-btn secondary" onclick="closeModal()">انصراف</button>
          <button class="modal-btn danger" onclick="doReject()">❌ رد تسویه</button>
        `;

  document.getElementById('detailModal').classList.add('open');
}
window.openRejectModal = openRejectModal;

function closeModal() {
  document.getElementById('detailModal').classList.remove('open');
  _activeIdx = null;
}
window.closeModal = closeModal;

document.getElementById('detailModal').addEventListener('click', (e) => {
  if (e.target.id === 'detailModal') closeModal();
});

// ═══════════════════════════════════════════
// API ACTIONS
// ═══════════════════════════════════════════
async function doApprove() {
  const s = _settlements[_activeIdx];
  if (!s) return;
  try {
    const note = document.getElementById('modalNote').value.trim();
    const res = await fetch(`${API}/settlements/${s._id}/approve`, {
      method: 'PATCH',
      headers: authH(),
      body: JSON.stringify({ adminNote: note }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    toast('✓ تسویه تأیید شد');
    closeModal();
    loadSettlements();
    loadCommissionSummary();
  } catch (err) {
    toast('❌ ' + err.message, true);
  }
}
window.doApprove = doApprove;

async function doPay() {
  const s = _settlements[_activeIdx];
  if (!s) return;
  try {
    const note = document.getElementById('modalNote').value.trim();
    const res = await fetch(`${API}/settlements/${s._id}/pay`, {
      method: 'PATCH',
      headers: authH(),
      body: JSON.stringify({ adminNote: note }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    toast('💸 پرداخت ثبت شد');
    closeModal();
    loadSettlements();
    loadCommissionSummary();
  } catch (err) {
    toast('❌ ' + err.message, true);
  }
}
window.doPay = doPay;

async function doReject() {
  const s = _settlements[_activeIdx];
  if (!s) return;
  if (!confirm('آیا از رد این تسویه مطمئنی؟')) return;
  try {
    const note = document.getElementById('modalNote').value.trim();
    const res = await fetch(`${API}/settlements/${s._id}/reject`, {
      method: 'PATCH',
      headers: authH(),
      body: JSON.stringify({ adminNote: note }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    toast('✓ تسویه رد شد');
    closeModal();
    loadSettlements();
    loadCommissionSummary();
  } catch (err) {
    toast('❌ ' + err.message, true);
  }
}
window.doReject = doReject;

// ── INIT ──
initPage();
