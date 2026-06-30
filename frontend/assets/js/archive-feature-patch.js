/**
 * ══════════════════════════════════════════════════════════════════
 *  ARCHIVE FEATURE — پچ رابط کاربری
 *  این کد رو به انتهای <script> در admin.html و owner.html اضافه کن
 *  (قبل از بستن تگ </script>)
 *
 *  ویژگی‌ها:
 *  ✓ دکمه «آرشیو» کنار هر رزرو — رزرو از تاریخچه پنهان می‌شه
 *  ✓ دکمه toggle «نمایش آرشیو» — آرشیوشده‌ها رو نشون می‌ده
 *  ✓ آرشیو دسته‌جمعی (فقط ادمین: همه لغوشده‌ها / همه پرداختی‌ها)
 *  ✓ درآمد: بدون تغییر — آرشیوشده‌ها همچنان در درآمد حساب می‌شن
 * ══════════════════════════════════════════════════════════════════
 */

// ─────────────────────────────────────
// 1. CSS — به <style> صفحه اضافه کن
// ─────────────────────────────────────
const ARCHIVE_CSS = `
.res-archive-btn {
  padding: 6px 13px;
  border-radius: 7px;
  font-family: 'Vazirmatn', sans-serif;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  background: rgba(99,102,241,0.1);
  color: #818cf8;
  border: 1px solid rgba(99,102,241,0.3);
}
.res-archive-btn:hover {
  background: rgba(99,102,241,0.2);
  border-color: #818cf8;
}
.res-item.archived-row {
  opacity: 0.55;
  border-style: dashed;
}
.archived-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 20px;
  background: rgba(99,102,241,0.12);
  color: #818cf8;
  border: 1px solid rgba(99,102,241,0.3);
  white-space: nowrap;
}
.archive-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 12px 16px;
  background: rgba(99,102,241,0.05);
  border: 1px solid rgba(99,102,241,0.2);
  border-radius: 10px;
  margin-bottom: 14px;
}
.archive-toolbar-title {
  font-size: 12px;
  font-weight: 700;
  color: #818cf8;
  flex: 1;
}
.archive-toggle-btn {
  padding: 7px 16px;
  border-radius: 8px;
  font-family: 'Vazirmatn', sans-serif;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  background: rgba(99,102,241,0.1);
  color: #818cf8;
  border: 1px solid rgba(99,102,241,0.3);
}
.archive-toggle-btn:hover,
.archive-toggle-btn.active {
  background: #818cf8;
  color: #04100a;
}
.bulk-archive-btn {
  padding: 7px 14px;
  border-radius: 8px;
  font-family: 'Vazirmatn', sans-serif;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  background: transparent;
  color: #818cf8;
  border: 1px solid rgba(99,102,241,0.3);
}
.bulk-archive-btn:hover {
  background: rgba(99,102,241,0.15);
}
`;

// تزریق CSS به صفحه
(function injectArchiveCSS() {
  const style = document.createElement('style');
  style.textContent = ARCHIVE_CSS;
  document.head.appendChild(style);
})();

// ─────────────────────────────────────
// 2. STATE آرشیو
// ─────────────────────────────────────
let _showArchived = false;

// ─────────────────────────────────────
// 3. تابع آرشیو یک رزرو (toggle)
// ─────────────────────────────────────
async function archiveReservation(id) {
  try {
    const res = await fetch(`${API}/owner/reservations/${id}/archive`, {
      method: 'PATCH',
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);

    const msg = data.archived ? 'رزرو آرشیو شد' : 'از آرشیو خارج شد';
    toast('📦 ' + msg);

    // رفرش لیست
    if (typeof loadAdminReservations === 'function') {
      await loadAdminReservations();
    } else if (typeof loadReservations === 'function') {
      await loadReservations();
    }
  } catch (err) {
    toast('❌ ' + err.message, true);
  }
}
window.archiveReservation = archiveReservation;

// ─────────────────────────────────────
// 4. تابع آرشیو دسته‌جمعی
// ─────────────────────────────────────
async function bulkArchive(options = {}) {
  const { pitchId, status, olderThanDays, label } = options;

  const confirmMsg = label
    ? `آرشیو دسته‌جمعی: ${label}؟\n\nاین رزروها از تاریخچه پنهان می‌شن ولی درآمدشون باقی می‌مونه.`
    : 'آرشیو دسته‌جمعی انجام بشه؟';

  if (!confirm(confirmMsg)) return;

  try {
    const body = {};
    if (pitchId) body.pitchId = pitchId;
    if (status) body.status = status;
    if (olderThanDays) body.olderThanDays = olderThanDays;

    const res = await fetch(`${API}/owner/reservations/bulk-archive`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);

    toast(`📦 ${numFa(data.archived)} رزرو آرشیو شد`);

    if (typeof loadAdminReservations === 'function') {
      await loadAdminReservations();
    } else if (typeof loadReservations === 'function') {
      await loadReservations();
    }
  } catch (err) {
    toast('❌ ' + err.message, true);
  }
}
window.bulkArchive = bulkArchive;

// ─────────────────────────────────────
// 5. toggle نمایش آرشیو
// ─────────────────────────────────────
function toggleShowArchived() {
  _showArchived = !_showArchived;
  const btn = document.getElementById('archiveToggleBtn');
  if (btn) btn.classList.toggle('active', _showArchived);

  if (typeof loadAdminReservations === 'function') {
    loadAdminReservations();
  } else if (typeof loadReservations === 'function') {
    loadReservations();
  }
}
window.toggleShowArchived = toggleShowArchived;

// ─────────────────────────────────────
// 6. تابع inject نوار آرشیو بالای لیست رزروها
//    این رو بعد از render کردن لیست رزروها صدا بزن
// ─────────────────────────────────────
function injectArchiveToolbar(containerEl, isAdmin = false) {
  // جلوگیری از duplicate
  const existing = containerEl.querySelector('.archive-toolbar');
  if (existing) existing.remove();

  const toolbar = document.createElement('div');
  toolbar.className = 'archive-toolbar';
  toolbar.innerHTML = `
    <span class="archive-toolbar-title">📦 مدیریت آرشیو رزروها</span>
    <button class="archive-toggle-btn ${_showArchived ? 'active' : ''}"
      id="archiveToggleBtn"
      onclick="toggleShowArchived()">
      ${_showArchived ? '🙈 پنهان کردن آرشیو' : '👁️ نمایش آرشیوشده‌ها'}
    </button>
    ${
      isAdmin
        ? `
      <button class="bulk-archive-btn"
        onclick="bulkArchive({status:'cancelled', label:'همه رزروهای لغوشده'})">
        آرشیو همه لغوشده‌ها
      </button>
      <button class="bulk-archive-btn"
        onclick="bulkArchive({status:'paid', olderThanDays:90, label:'پرداختی‌های قدیمی‌تر از ۳ ماه'})">
        آرشیو پرداختی‌های +۳ ماه
      </button>
    `
        : `
      <button class="bulk-archive-btn"
        onclick="bulkArchive({status:'cancelled', label:'همه رزروهای لغوشده'})">
        آرشیو همه لغوشده‌ها
      </button>
    `
    }
  `;

  containerEl.insertBefore(toolbar, containerEl.firstChild);
}
window.injectArchiveToolbar = injectArchiveToolbar;

// ─────────────────────────────────────
// 7. تابع کمکی — دکمه آرشیو برای یه ردیف رزرو
// ─────────────────────────────────────
function archiveBtn(reservationId, isArchived) {
  return `<button class="res-archive-btn"
    onclick="archiveReservation('${reservationId}')"
    title="${isArchived ? 'خارج کردن از آرشیو' : 'آرشیو این رزرو'}">
    ${isArchived ? '📤 از آرشیو خارج کن' : '📦 آرشیو'}
  </button>`;
}
window.archiveBtn = archiveBtn;

// ─────────────────────────────────────────────────────────────────────
// 8. OVERRIDE توابع موجود
//    این بخش توابع loadAdminReservations و renderAdminReservations رو
//    override می‌کنه تا آرشیو رو پشتیبانی کنه.
//    اگه صفحه owner.html هستی، بخش مربوط به owner رو فعال کن.
// ─────────────────────────────────────────────────────────────────────

// ── ADMIN: override loadAdminReservations ──
if (typeof loadAdminReservations !== 'undefined') {
  const _origLoad = loadAdminReservations;
  window.loadAdminReservations = async function () {
    const tbody = document.getElementById('reservationsTableBody');
    if (tbody)
      tbody.innerHTML =
        '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--muted)">در حال بارگذاری رزروها...</td></tr>';

    try {
      const url = `${API}/reservations${_showArchived ? '?showArchived=1' : ''}`;
      const res = await fetch(url, { headers: authHeaders() });
      if (res.status === 401 || res.status === 403) {
        goToAdminLogin('⚠️ نشست منقضی شده یا دسترسی ادمین نداری');
        return;
      }
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      STATE.reservations = data.reservations || [];
    } catch (e) {
      STATE.reservations = [];
      toast('❌ خطا در دریافت رزروها: ' + (e.message || 'نامشخص'), true);
    }
    populateResPitchFilter();
    renderAdminReservations();

    // تزریق نوار آرشیو
    const resSection = document.querySelector(
      '#panel-reservations .slots-table-wrap',
    );
    const parentEl = resSection ? resSection.parentElement : null;
    if (parentEl) injectArchiveToolbar(parentEl, true);
  };
}

// ── ADMIN: override renderAdminReservations تا دکمه آرشیو اضافه بشه ──
if (typeof renderAdminReservations !== 'undefined') {
  const _origRender = renderAdminReservations;
  window.renderAdminReservations = function () {
    const tbody = document.getElementById('reservationsTableBody');
    if (!tbody) return;

    const statusFilter =
      document.getElementById('resStatusFilter')?.value || '';
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

    if (!list.length) {
      tbody.innerHTML =
        '<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--muted)">رزروی پیدا نشد</td></tr>';
      return;
    }

    list = [...list].sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
    );

    tbody.innerHTML = list
      .map((r) => {
        const u = r.user || {};
        const p = r.pitch || {};
        const st = stMap[r.status] || stMap.pending;
        const isArch = r.isArchived;

        let actions = '';
        if (r.status === 'pending' && !isArch) {
          actions = `
          <button class="bulk-apply" onclick="adminSetResStatus('${r._id}','paid')">تایید پرداخت</button>
          <button class="bulk-apply" style="background:rgba(239,68,68,.1);color:var(--red);border-color:rgba(239,68,68,.25);margin-right:6px"
            onclick="adminSetResStatus('${r._id}','cancelled')">لغو</button>`;
        } else if (r.status === 'paid' && !isArch) {
          actions = `<button class="bulk-apply" style="background:rgba(239,68,68,.1);color:var(--red);border-color:rgba(239,68,68,.25)"
          onclick="adminSetResStatus('${r._id}','cancelled')">لغو رزرو</button>`;
        }

        return `<tr style="${isArch ? 'opacity:.5;' : ''}">
        <td>${u.name || '—'}<br><span style="font-size:11px;color:var(--muted)">${u.phone || ''}</span></td>
        <td>${p.name || '—'}</td>
        <td>${r.date || '—'}</td>
        <td>${r.slotTime || '—'}</td>
        <td style="color:var(--green);font-weight:700;white-space:nowrap">${priceFa(r.amount)} ت</td>
        <td>
          <span class="peak-tag ${st.cls}">${st.label}</span>
          ${isArch ? '<span class="archived-badge" style="margin-right:4px">📦 آرشیو</span>' : ''}
        </td>
        <td style="display:flex;flex-wrap:wrap;gap:5px;align-items:center">
          ${actions}
          ${archiveBtn(r._id, isArch)}
        </td>
      </tr>`;
      })
      .join('');
  };
}

// ── OWNER: اگه owner.html هستی، این تابع رو صدا بزن بعد از loadReservations ──
// در owner.html، بعد از خط «filterAndRenderReservations();» این رو اضافه کن:
//
//   const ownerResSection = document.querySelector('.res-section');
//   if (ownerResSection) injectArchiveToolbar(ownerResSection, false);
//
// و در تابع loadReservations، url رو اینطوری عوض کن:
//   const url = `${API}/owner/pitches/${p._id}/reservations${_showArchived ? '?showArchived=1' : ''}`;
//
// و در renderReservations، برای هر res-item یه دکمه archiveBtn() اضافه کن:
//   در بخش singles.forEach، داخل .res-right این رو اضافه کن:
//     ${archiveBtn(r._id, r.isArchived)}
//   و اگه r.isArchived === true، کلاس archived-row رو به .res-item اضافه کن

console.log('✅ Archive feature patch loaded');
