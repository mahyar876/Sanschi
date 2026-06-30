const API = 'http://localhost:5000/api';
function getToken() {
  return sessionStorage.getItem('sns_token') || '';
}
function authH() {
  return {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + getToken(),
  };
}
function numFa(n) {
  return String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
}
function priceFa(n) {
  return numFa(Math.round(n || 0).toLocaleString('en'));
}
function shortFa(n) {
  n = Math.round(n || 0);
  if (n >= 1000000) {
    const m = (n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1);
    return numFa(m.replace(/\.0$/, '')) + 'م';
  }
  if (n >= 1000) return numFa(Math.round(n / 1000)) + 'هـ';
  return numFa(n);
}
function logout() {
  sessionStorage.removeItem('sns_token');
  sessionStorage.removeItem('sns_user');
  window.location.href = './login.html';
}
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

let STATE = {
  reservations: [],
  settlements: [],
  summary: null,
  demo: false,
};

function commissionOf(r) {
  if (r.siteCommission != null) return r.siteCommission;
  return 0;
}
function shareOf(r) {
  if (r.pitchAmount != null) return r.pitchAmount;
  return Math.max(0, (r.amount || 0) - commissionOf(r));
}
function inPeriod(r) {
  const period = document.getElementById('periodSel').value;
  if (period === 'all') return true;
  const d = r.createdAt ? new Date(r.createdAt) : null;
  if (!d || isNaN(d)) return true;
  const days = { day: 1, week: 7, month: 30, year: 365 }[period] || 99999;
  return Date.now() - d.getTime() <= days * 86400000;
}
function pitchName(r) {
  if (r.pitch && r.pitch.name) return r.pitch.name;
  return 'زمین نامشخص';
}

async function loadAll() {
  try {
    const ctl = new AbortController();
    setTimeout(() => ctl.abort(), 4500);
    const [res, set, sum] = await Promise.all([
      fetch(API + '/reservations', {
        headers: authH(),
        signal: ctl.signal,
      }).then((r) => r.json()),
      fetch(API + '/settlements', {
        headers: authH(),
        signal: ctl.signal,
      })
        .then((r) => r.json())
        .catch(() => ({})),
      fetch(API + '/settlements/summary', {
        headers: authH(),
        signal: ctl.signal,
      })
        .then((r) => r.json())
        .catch(() => ({})),
    ]);
    if (!res || !res.success) throw new Error('no data');
    STATE.reservations = res.reservations || [];
    STATE.settlements = (set && set.settlements) || [];
    STATE.summary = sum && sum.byStatus ? sum : null;
    STATE.demo = false;
  } catch (e) {
    STATE.reservations = MOCK.reservations();
    STATE.settlements = MOCK.settlements();
    STATE.summary = MOCK.summary();
    STATE.demo = true;
  }
  document.getElementById('demoFlag').style.display = STATE.demo
    ? 'block'
    : 'none';
}

function computeTotals() {
  const list = STATE.reservations.filter(inPeriod);
  let gross = 0,
    comm = 0,
    net = 0,
    paidCount = 0;
  list.forEach((r) => {
    if (r.status === 'paid') {
      gross += r.amount || 0;
      comm += commissionOf(r);
      net += shareOf(r);
      paidCount++;
    } else if (r.status === 'cancelled' && r.siteCommission != null) {
      comm += commissionOf(r);
    }
  });
  return { gross, comm, net, paidCount, list };
}

function summaryNet() {
  const b = STATE.summary && STATE.summary.byStatus;
  if (!b) return { pendingNet: 0, paidNet: 0 };
  const pendingNet = (b.pending.net || 0) + (b.approved.net || 0);
  const paidNet = b.paid.net || 0;
  return { pendingNet, paidNet };
}

function countUp(el, target, fmt) {
  const dur = 700;
  const start = performance.now();
  function tick(now) {
    const p = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(target * eased);
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function renderKPIs(t) {
  const sn = summaryNet();
  const cards = [
    {
      ic: '💰',
      label: 'کمیسیون سانس‌چی',
      val: t.comm,
      cls: 'k-green',
      unit: 'تومان',
      feat: true,
    },
    {
      ic: '💵',
      label: 'کل گردش مالی پلتفرم',
      val: t.gross,
      cls: 'k-text',
      unit: 'تومان',
    },
    {
      ic: '🤝',
      label: 'سهم صاحبان زمین',
      val: t.net,
      cls: 'k-blue',
      unit: 'تومان',
    },
    {
      ic: '⏳',
      label: 'بدهی تسویه‌نشده به اونرها',
      val: sn.pendingNet,
      cls: 'k-amber',
      unit: 'تومان',
    },
    {
      ic: '✅',
      label: 'تسویه‌شده با اونرها',
      val: sn.paidNet,
      cls: 'k-green',
      unit: 'تومان',
    },
    {
      ic: '🎫',
      label: 'رزرو پرداخت‌شده',
      val: t.paidCount,
      cls: 'k-text',
      unit: 'سانس',
      isCount: true,
    },
  ];
  const grid = document.getElementById('kpiGrid');
  grid.innerHTML = cards
    .map(
      (c, i) => `
          <div class="kpi ${c.feat ? 'feat' : ''}">
            <span class="k-ic">${c.ic}</span>
            <div class="k-label">${c.label}</div>
            <div class="k-val ${c.cls}" id="kpi${i}">۰</div>
            <div class="k-unit">${c.unit}</div>
          </div>`,
    )
    .join('');
  cards.forEach((c, i) =>
    countUp(document.getElementById('kpi' + i), c.val, (v) =>
      c.isCount ? numFa(Math.round(v)) : priceFa(v),
    ),
  );
}

function renderChart(t) {
  const canvas = document.getElementById('commChart');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.parentElement.clientWidth || 700;
  const cssH = 220;
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  canvas.style.height = cssH + 'px';
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssW, cssH);
  const paid = t.list.filter((r) => r.status === 'paid');
  const map = {};
  paid.forEach((r) => {
    const key = r.date || '—';
    map[key] = (map[key] || 0) + commissionOf(r);
  });
  let entries = Object.entries(map);
  if (!entries.length) {
    ctx.fillStyle = '#3d6650';
    ctx.font = '13px Vazirmatn';
    ctx.textAlign = 'center';
    ctx.fillText('داده‌ای برای نمایش نیست', cssW / 2, cssH / 2);
    return;
  }
  entries = entries
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    .slice(-14);
  const max = Math.max(...entries.map((e) => e[1]));
  const padB = 34,
    padT = 16,
    padL = 8,
    padR = 8;
  const gw = (cssW - padL - padR) / entries.length;
  const bw = Math.min(40, gw * 0.6);
  entries.forEach((e, i) => {
    const h = max ? (e[1] / max) * (cssH - padB - padT) : 0;
    const x = padL + i * gw + (gw - bw) / 2;
    const y = cssH - padB - h;
    const grad = ctx.createLinearGradient(0, y, 0, cssH - padB);
    grad.addColorStop(0, '#22c55e');
    grad.addColorStop(1, '#16a34a');
    ctx.fillStyle = grad;
    const rr = 6;
    ctx.beginPath();
    ctx.moveTo(x, cssH - padB);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.lineTo(x + bw - rr, y);
    ctx.quadraticCurveTo(x + bw, y, x + bw, y + rr);
    ctx.lineTo(x + bw, cssH - padB);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#7fa98c';
    ctx.font = '700 9px Vazirmatn';
    ctx.textAlign = 'center';
    ctx.fillText(shortFa(e[1]), x + bw / 2, y - 5);
    const lbl = String(e[0]).split('/').slice(-1)[0];
    ctx.fillStyle = '#3d6650';
    ctx.font = '9px Vazirmatn';
    ctx.fillText(numFa(lbl), x + bw / 2, cssH - padB + 16);
  });
}

function renderPitchTable(t) {
  const groups = {};
  t.list.forEach((r) => {
    if (r.status !== 'paid') return;
    const name = pitchName(r);
    if (!groups[name]) groups[name] = { count: 0, gross: 0, comm: 0, net: 0 };
    const g = groups[name];
    g.count++;
    g.gross += r.amount || 0;
    g.comm += commissionOf(r);
    g.net += shareOf(r);
  });
  const rows = Object.entries(groups).sort((a, b) => b[1].comm - a[1].comm);
  const body = document.getElementById('pitchBody');
  const foot = document.getElementById('pitchFoot');
  if (!rows.length) {
    body.innerHTML =
      '<tr><td colspan="6" class="empty">رزرو پرداخت‌شده‌ای در این بازه نیست</td></tr>';
    foot.innerHTML = '';
    return;
  }
  let sc = 0,
    sg = 0,
    scomm = 0,
    sn = 0;
  body.innerHTML = rows
    .map(([name, g]) => {
      sc += g.count;
      sg += g.gross;
      scomm += g.comm;
      sn += g.net;
      const avg = g.count ? g.comm / g.count : 0;
      return `<tr>
              <td style="font-weight:700">${name}</td>
              <td>${numFa(g.count)}</td>
              <td>${priceFa(g.gross)}</td>
              <td class="comm">${priceFa(g.comm)}</td>
              <td class="pos">${priceFa(g.net)}</td>
              <td>${priceFa(avg)}</td>
            </tr>`;
    })
    .join('');
  foot.innerHTML = `<tr>
          <td>جمع کل</td>
          <td>${numFa(sc)}</td>
          <td>${priceFa(sg)}</td>
          <td class="comm">${priceFa(scomm)}</td>
          <td class="pos">${priceFa(sn)}</td>
          <td>${priceFa(sc ? scomm / sc : 0)}</td>
        </tr>`;
}

function renderPipeline() {
  const b = STATE.summary && STATE.summary.byStatus;
  const data = b || {
    pending: { count: 0, net: 0, commission: 0 },
    approved: { count: 0, net: 0, commission: 0 },
    paid: { count: 0, net: 0, commission: 0 },
    rejected: { count: 0, net: 0, commission: 0 },
  };
  const defs = [
    { key: 'pending', name: '⏳ در انتظار تأیید', cls: 'pending' },
    { key: 'approved', name: '🔵 تأییدشده', cls: 'approved' },
    { key: 'paid', name: '✅ پرداخت‌شده', cls: 'paid' },
    { key: 'rejected', name: '❌ ردشده', cls: 'rejected' },
  ];
  document.getElementById('pipeline').innerHTML = defs
    .map((d) => {
      const s = data[d.key] || { count: 0, net: 0, commission: 0 };
      return `<div class="pipe ${d.cls}">
              <div class="p-top">
                <span class="p-name">${d.name}</span>
                <span class="p-count">${numFa(s.count || 0)} تسویه</span>
              </div>
              <div class="p-net">${priceFa(s.net)} ت</div>
              <div class="p-sub">کمیسیون: ${priceFa(s.commission)} ت</div>
            </div>`;
    })
    .join('');
}

function renderSettlements() {
  const list = STATE.settlements;
  const body = document.getElementById('settleBody');
  if (!list.length) {
    body.innerHTML =
      '<tr><td colspan="7" class="empty">هنوز تسویه‌ای ثبت نشده است</td></tr>';
    return;
  }
  const stat = {
    pending: '<span class="badge b-pending">در انتظار</span>',
    approved: '<span class="badge b-approved">تأییدشده</span>',
    paid: '<span class="badge b-paid">پرداخت‌شده</span>',
    rejected: '<span class="badge b-rejected">ردشده</span>',
  };
  body.innerHTML = list
    .slice()
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 30)
    .map(
      (s) => `<tr>
            <td>${numFa(s.date || '—')}</td>
            <td>${(s.owner && s.owner.name) || '—'}</td>
            <td>${(s.pitch && s.pitch.name) || '—'}</td>
            <td>${priceFa(s.grossAmount)}</td>
            <td class="comm">${priceFa(s.commissionAmount)}</td>
            <td class="pos">${priceFa(s.netAmount)}</td>
            <td>${stat[s.status] || s.status}</td>
          </tr>`,
    )
    .join('');
}

function renderCommByPitch(t) {
  const el = document.getElementById('commByPitchList');
  if (!el) return;
  const groups = {};
  t.list.forEach((r) => {
    if (r.status !== 'paid') return;
    const name = pitchName(r);
    if (!groups[name]) groups[name] = 0;
    groups[name] += commissionOf(r);
  });
  const rows = Object.entries(groups).sort((a, b) => b[1] - a[1]);
  if (!rows.length) {
    el.innerHTML =
      '<div style="color:var(--muted);text-align:center;padding:20px">داده‌ای وجود ندارد</div>';
    return;
  }
  const max = rows[0][1] || 1;
  el.innerHTML = rows
    .map(
      ([name, val]) => `
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
            <span style="min-width:120px;font-size:12px;color:var(--text);text-align:right">${name}</span>
            <div style="flex:1;background:rgba(34,197,94,0.1);border-radius:4px;height:10px">
              <div style="width:${Math.round((val / max) * 100)}%;background:var(--green);height:10px;border-radius:4px"></div>
            </div>
            <span style="min-width:80px;font-size:12px;color:var(--green);text-align:left">${priceFa(val)}</span>
          </div>`,
    )
    .join('');
}

function renderAvgComm(t) {
  const el = document.getElementById('avgCommList');
  if (!el) return;
  const groups = {};
  t.list.forEach((r) => {
    if (r.status !== 'paid') return;
    const name = pitchName(r);
    if (!groups[name]) groups[name] = { sum: 0, count: 0 };
    groups[name].sum += commissionOf(r);
    groups[name].count++;
  });
  const rows = Object.entries(groups)
    .map(([n, g]) => [n, g.count ? g.sum / g.count : 0])
    .sort((a, b) => b[1] - a[1]);
  if (!rows.length) {
    el.innerHTML =
      '<div style="color:var(--muted);text-align:center;padding:20px">داده‌ای وجود ندارد</div>';
    return;
  }
  el.innerHTML = rows
    .map(
      ([name, avg]) => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(34,197,94,0.08)">
            <span style="font-size:13px;color:var(--text)">${name}</span>
            <span style="font-size:13px;color:var(--amber);font-weight:700">${priceFa(avg)} ت</span>
          </div>`,
    )
    .join('');
}

function renderTopSlots(t) {
  const el = document.getElementById('topSlotsList');
  if (!el) return;
  const slots = {};
  t.list.forEach((r) => {
    if (r.status !== 'paid') return;
    const time = r.slotTime || '—';
    if (!slots[time])
      slots[time] = {
        count: 0,
        peak:
          time.includes('۱۸') ||
          time.includes('۱۹') ||
          time.includes('۲۰') ||
          time.includes('۲۱'),
      };
    slots[time].count++;
  });
  const rows = Object.entries(slots)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8);
  if (!rows.length) {
    el.innerHTML =
      '<div style="color:var(--muted);text-align:center;padding:20px">داده‌ای وجود ندارد</div>';
    return;
  }
  el.innerHTML = rows
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
function render() {
  const t = computeTotals();
  renderKPIs(t);
  renderChart(t);
  renderPitchTable(t);
  renderPipeline();
  renderSettlements();
  renderCommByPitch(t);
  renderAvgComm(t);
  renderTopSlots(t);
}

function exportCSV() {
  const t = computeTotals();
  const rows = [
    ['تاریخ', 'زمین', 'مشتری پرداخت', 'کمیسیون سانس‌چی', 'سهم اونر', 'وضعیت'],
  ];
  t.list.forEach((r) => {
    rows.push([
      r.date || '',
      pitchName(r),
      r.amount || 0,
      commissionOf(r),
      r.status === 'paid' ? shareOf(r) : 0,
      r.status,
    ]);
  });
  const csv = '\uFEFF' + rows.map((r) => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'sanschi-admin-finance.csv';
  a.click();
  toast('فایل CSV دانلود شد ✓');
}

// ── MOCK (offline/demo) ──
const MOCK = {
  reservations() {
    const pitches = [
      { name: 'سالن فوتسال آریا', base: 650000, comm: 50000 },
      { name: 'چمن فوتبال پارک ملت', base: 700000, comm: 80000 },
      { name: 'فوتسال ستاره شرق', base: 600000, comm: 60000 },
    ];
    const out = [];
    let idx = 0;
    pitches.forEach((p) => {
      const n = 10 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) {
        const peak = i % 3 === 0;
        const amount = p.base + (peak ? 50000 : 0) + p.comm;
        const st =
          i % 7 === 6 ? 'pending' : i % 11 === 10 ? 'cancelled' : 'paid';
        const paidLike = st === 'paid' || st === 'cancelled';
        const days = Math.floor(i * 1.5);
        out.push({
          code: 'SNS-' + (idx++).toString(36).toUpperCase(),
          date: '1404/04/' + String(((26 - i) % 30) + 1).padStart(2, '0'),
          slotTime: peak ? '۱۹:۳۰–۲۱:۰۰' : '۱۰:۳۰–۱۲:۰۰',
          amount,
          status: st,
          siteCommission: paidLike ? p.comm : null,
          pitchAmount: paidLike ? amount - p.comm : null,
          pitch: { name: p.name },
          createdAt: new Date(Date.now() - days * 86400000).toISOString(),
        });
      }
    });
    return out;
  },
  settlements() {
    const mk = (date, owner, pitch, status, n, comm) => ({
      date,
      status,
      owner: { name: owner },
      pitch: { name: pitch },
      grossAmount: n * (700000 + comm),
      commissionAmount: n * comm,
      netAmount: n * 700000,
      paidCount: n,
    });
    return [
      mk('1404/04/15', 'رضا کریمی', 'سالن فوتسال آریا', 'pending', 5, 50000),
      mk(
        '1404/04/14',
        'مهدی نوری',
        'چمن فوتبال پارک ملت',
        'approved',
        4,
        80000,
      ),
      mk('1404/04/12', 'سارا احمدی', 'فوتسال ستاره شرق', 'paid', 6, 60000),
      mk('1404/04/10', 'رضا کریمی', 'سالن فوتسال آریا', 'paid', 7, 50000),
    ];
  },
  summary() {
    return {
      byStatus: {
        pending: {
          count: 1,
          gross: 3750000,
          commission: 250000,
          net: 3500000,
        },
        approved: {
          count: 1,
          gross: 3120000,
          commission: 320000,
          net: 2800000,
        },
        paid: {
          count: 2,
          gross: 8980000,
          commission: 660000,
          net: 8320000,
        },
        rejected: { count: 0, gross: 0, commission: 0, net: 0 },
      },
    };
  },
};

(async function init() {
  await loadAll();
  render();
  window.addEventListener('resize', () => renderChart(computeTotals()));
})();
