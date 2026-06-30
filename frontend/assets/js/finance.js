// ══════════════════════════════════════
// CONFIG / HELPERS
// ══════════════════════════════════════
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

// ══════════════════════════════════════
// STATE
// ══════════════════════════════════════
let STATE = {
  pitches: [],
  pitchId: '',
  reservations: [],
  settlements: [],
  filter: 'paid',
  demo: false,
};

// ══════════════════════════════════════
// COMMISSION / SHARE LOGIC (matches backend)
// ══════════════════════════════════════
function pitchOf(id) {
  return STATE.pitches.find((p) => (p._id || p.id) === id);
}
function commissionOf(r) {
  if (r.siteCommission != null) return r.siteCommission;
  const p = pitchOf(STATE.pitchId);
  return (p && p.commissionAmount) || 0;
}
function shareOf(r) {
  if (r.pitchAmount != null) return r.pitchAmount;
  return Math.max(0, (r.amount || 0) - commissionOf(r));
}

// period filter using createdAt (ISO)
function inPeriod(r) {
  const period = document.getElementById('periodSel').value;
  if (period === 'all') return true;
  const d = r.createdAt ? new Date(r.createdAt) : null;
  if (!d || isNaN(d)) return true;
  const now = Date.now();
  const days = { day: 1, week: 7, month: 30, year: 365 }[period] || 99999;
  return now - d.getTime() <= days * 86400000;
}

// ══════════════════════════════════════
// DATA LOADING
// ══════════════════════════════════════
async function loadPitches() {
  try {
    const ctl = new AbortController();
    setTimeout(() => ctl.abort(), 3500);
    const res = await fetch(API + '/owner/pitches', {
      headers: authH(),
      signal: ctl.signal,
    });
    const data = await res.json();
    if (!data.success || !data.pitches.length) throw new Error('empty');
    STATE.pitches = data.pitches;
    STATE.demo = false;
  } catch (e) {
    STATE.pitches = MOCK.pitches;
    STATE.demo = true;
  }
  const sel = document.getElementById('pitchSel');
  sel.innerHTML = STATE.pitches
    .map(
      (p) =>
        `<option value="${p._id || p.id}">${p.name} — کارمزد ${priceFa(
          p.commissionAmount || 0,
        )} ت</option>`,
    )
    .join('');
  STATE.pitchId = STATE.pitches[0]._id || STATE.pitches[0].id;
  document.getElementById('demoFlag').style.display = STATE.demo
    ? 'block'
    : 'none';
}

async function loadData() {
  const pid = STATE.pitchId;
  if (STATE.demo) {
    STATE.reservations = MOCK.reservations(pid);
    STATE.settlements = MOCK.settlements(pid);
    return;
  }
  try {
    const ctl = new AbortController();
    setTimeout(() => ctl.abort(), 4000);
    const [rRes, rSet] = await Promise.all([
      fetch(API + '/owner/pitches/' + pid + '/reservations', {
        headers: authH(),
        signal: ctl.signal,
      }).then((r) => r.json()),
      fetch(API + '/settlements/my', {
        headers: authH(),
        signal: ctl.signal,
      })
        .then((r) => r.json())
        .catch(() => ({ settlements: [] })),
    ]);
    STATE.reservations = (rRes && rRes.reservations) || [];
    STATE.settlements = ((rSet && rSet.settlements) || []).filter(
      (s) => !s.pitch || (s.pitch._id || s.pitch) === pid,
    );
  } catch (e) {
    STATE.reservations = MOCK.reservations(pid);
    STATE.settlements = MOCK.settlements(pid);
    STATE.demo = true;
    document.getElementById('demoFlag').style.display = 'block';
  }
}

// ══════════════════════════════════════
// RENDER
// ══════════════════════════════════════
function computeTotals() {
  const list = STATE.reservations.filter(inPeriod);
  let gross = 0,
    comm = 0,
    net = 0,
    paidCount = 0,
    pendingAmt = 0,
    pendingCount = 0,
    voidComm = 0;
  list.forEach((r) => {
    const c = commissionOf(r);
    const sh = shareOf(r);
    if (r.status === 'paid') {
      gross += r.amount || 0;
      comm += c;
      net += sh;
      paidCount++;
    } else if (r.status === 'pending') {
      pendingAmt += r.amount || 0;
      pendingCount++;
    } else if (r.status === 'cancelled' && r.siteCommission != null) {
      voidComm += c; // commission kept on voided-paid
    }
  });
  return {
    gross,
    comm,
    net,
    paidCount,
    pendingAmt,
    pendingCount,
    voidComm,
    list,
  };
}

function settleTotals() {
  let pendingNet = 0,
    paidNet = 0;
  STATE.settlements.forEach((s) => {
    if (s.status === 'paid') paidNet += s.netAmount || 0;
    else if (['pending', 'approved'].includes(s.status))
      pendingNet += s.netAmount || 0;
  });
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
  const st = settleTotals();
  const cards = [
    {
      ic: '💵',
      label: 'کل دریافتی از مشتری',
      val: t.gross,
      cls: 'k-text',
      unit: 'تومان',
    },
    {
      ic: '🏷️',
      label: 'کارمزد سانس‌چی',
      val: t.comm,
      cls: 'k-amber',
      unit: 'تومان',
    },
    {
      ic: '✅',
      label: 'سهم خالص شما',
      val: t.net,
      cls: 'k-green',
      unit: 'تومان',
      feat: true,
    },
    {
      ic: '⏳',
      label: 'در انتظار تسویه',
      val: st.pendingNet,
      cls: 'k-amber',
      unit: 'تومان',
    },
    {
      ic: '🏦',
      label: 'تسویه‌شده با شما',
      val: st.paidNet,
      cls: 'k-green',
      unit: 'تومان',
    },
    {
      ic: '🎫',
      label: 'رزرو پرداخت‌شده',
      val: t.paidCount,
      cls: 'k-blue',
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
  cards.forEach((c, i) => {
    const el = document.getElementById('kpi' + i);
    countUp(el, c.val, (v) => (c.isCount ? numFa(Math.round(v)) : priceFa(v)));
  });
}

function renderFlow(t) {
  const denom = t.paidCount || 1;
  const avgGross = t.gross / denom;
  const avgComm = t.comm / denom;
  const avgOwner = t.net / denom;
  const total = avgGross || 1;
  const commPct = Math.round((avgComm / total) * 100);
  const ownerPct = 100 - commPct;
  document.getElementById('flowCustomer').textContent = priceFa(avgGross);
  document.getElementById('flowComm').textContent = priceFa(avgComm);
  document.getElementById('flowOwner').textContent = priceFa(avgOwner);
  document.getElementById('flowCommPct').textContent =
    numFa(commPct) + '٪ از مبلغ';
  document.getElementById('flowOwnerPct').textContent =
    numFa(ownerPct) + '٪ از مبلغ';
  const bar = document.getElementById('flowBar');
  bar.innerHTML = `
          <span class="seg-owner" style="width:${ownerPct}%">${numFa(
            ownerPct,
          )}٪ شما</span>
          <span class="seg-comm" style="width:${commPct}%">${
            commPct >= 8 ? numFa(commPct) + '٪' : ''
          }</span>`;
}

// simple canvas bar chart of daily net
function renderChart(t) {
  const canvas = document.getElementById('revChart');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.parentElement.clientWidth || 700;
  const cssH = 220;
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  canvas.style.height = cssH + 'px';
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssW, cssH);

  // group paid reservations by day label
  const paid = t.list.filter((r) => r.status === 'paid');
  const map = {};
  paid.forEach((r) => {
    const key = r.date || '—';
    map[key] = (map[key] || 0) + shareOf(r);
  });
  let entries = Object.entries(map);
  if (!entries.length) {
    ctx.fillStyle = '#3d6650';
    ctx.font = '13px Vazirmatn';
    ctx.textAlign = 'center';
    ctx.fillText('داده‌ای برای نمایش نیست', cssW / 2, cssH / 2);
    return;
  }
  entries = entries.slice(-14);
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
    // value
    ctx.fillStyle = '#7fa98c';
    ctx.font = '700 9px Vazirmatn';
    ctx.textAlign = 'center';
    ctx.fillText(shortFa(e[1]), x + bw / 2, y - 5);
    // label (last part of date)
    const lbl = String(e[0]).split('/').slice(-1)[0];
    ctx.fillStyle = '#3d6650';
    ctx.font = '9px Vazirmatn';
    ctx.fillText(numFa(lbl), x + bw / 2, cssH - padB + 16);
  });
}

function renderLedger(t) {
  const f = STATE.filter;
  let rows = STATE.reservations.filter(inPeriod);
  if (f !== 'all') rows = rows.filter((r) => r.status === f);
  rows.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const body = document.getElementById('ledgerBody');
  const foot = document.getElementById('ledgerFoot');
  if (!rows.length) {
    body.innerHTML =
      '<tr><td colspan="7" class="empty">رزرویی در این دسته نیست</td></tr>';
    foot.innerHTML = '';
    return;
  }
  const badge = {
    paid: '<span class="badge b-paid">پرداخت‌شده</span>',
    pending: '<span class="badge b-pending">در انتظار</span>',
    cancelled: '<span class="badge b-cancelled">لغوشده</span>',
  };
  let sumPaid = 0,
    sumComm = 0,
    sumShare = 0;
  body.innerHTML = rows
    .map((r) => {
      const c = commissionOf(r);
      const sh = shareOf(r);
      const counts = r.status === 'paid';
      if (counts) {
        sumPaid += r.amount || 0;
        sumComm += c;
        sumShare += sh;
      }
      return `<tr>
              <td>${numFa(r.date || '—')}</td>
              <td>${r.slotTime || '—'}</td>
              <td class="mono">${r.code || '—'}</td>
              <td>${priceFa(r.amount)}</td>
              <td class="neg">${counts || r.siteCommission != null ? '−' + priceFa(c) : '—'}</td>
              <td class="${counts ? 'pos' : ''}">${counts ? priceFa(sh) : '—'}</td>
              <td>${badge[r.status] || r.status}</td>
            </tr>`;
    })
    .join('');
  foot.innerHTML = `<tr>
          <td colspan="3">جمع پرداخت‌شده‌ها</td>
          <td>${priceFa(sumPaid)}</td>
          <td class="neg">−${priceFa(sumComm)}</td>
          <td class="pos">${priceFa(sumShare)}</td>
          <td></td>
        </tr>`;
}

function renderSettlements() {
  const el = document.getElementById('settleList');
  const list = STATE.settlements;
  if (!list.length) {
    el.innerHTML =
      '<div class="empty">هنوز تسویه‌ای برای این زمین ثبت نشده است.</div>';
    return;
  }
  const order = { pending: 1, approved: 2, paid: 3, rejected: 0 };
  const stepDone = (s, step) => {
    if (s.status === 'rejected') return step === 1;
    return order[s.status] >= step;
  };
  const statusFa = {
    pending: 'در انتظار تأیید',
    approved: 'تأییدشده',
    paid: 'پرداخت‌شده',
    rejected: 'ردشده',
  };
  el.innerHTML = list
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .map((s) => {
      const rej = s.status === 'rejected';
      return `<div class="settle-card">
            <div class="settle-head">
              <div>
                <div class="sh-date">📅 ${numFa(s.date || '—')}</div>
                <div style="font-size:11.5px;color:var(--muted)">
                  ${s.pitch && s.pitch.name ? s.pitch.name : ''} · وضعیت: ${
                    statusFa[s.status] || s.status
                  }
                </div>
              </div>
              <div class="sh-net">${priceFa(s.netAmount)} ت</div>
            </div>
            <div class="timeline">
              <div class="tl-step ${stepDone(s, 1) ? 'done' : ''}">
                <div class="tl-dot">${stepDone(s, 1) ? '✓' : '۱'}</div>تولید تسویه
              </div>
              <div class="tl-step ${stepDone(s, 2) && !rej ? 'done' : ''}">
                <div class="tl-line"></div>
                <div class="tl-dot">${stepDone(s, 2) && !rej ? '✓' : '۲'}</div>${
                  rej ? 'ردشده' : 'تأیید ادمین'
                }
              </div>
              <div class="tl-step ${stepDone(s, 3) ? 'done' : ''}">
                <div class="tl-line"></div>
                <div class="tl-dot">${stepDone(s, 3) ? '✓' : '۳'}</div>واریز به شما
              </div>
            </div>
            <div class="settle-meta">
              <span>کل فروش: <b>${priceFa(s.grossAmount)} ت</b></span>
              <span>کارمزد سانس‌چی: <b>${priceFa(s.commissionAmount)} ت</b></span>
              <span>سهم خالص شما: <b style="color:var(--green)">${priceFa(
                s.netAmount,
              )} ت</b></span>
              <span>رزرو: <b>${numFa(s.paidCount || 0)}</b></span>
            </div>
          </div>`;
    })
    .join('');
}

function render() {
  const t = computeTotals();
  renderKPIs(t);
  renderFlow(t);
  renderChart(t);
  renderLedger(t);
  renderSettlements();
}

function setFilter(f) {
  STATE.filter = f;
  document
    .querySelectorAll('.seg-tab')
    .forEach((b) => b.classList.toggle('active', b.dataset.f === f));
  renderLedger(computeTotals());
}

async function onPitchChange() {
  STATE.pitchId = document.getElementById('pitchSel').value;
  await loadData();
  render();
}

function exportCSV() {
  const t = computeTotals();
  const rows = [
    [
      'تاریخ',
      'ساعت',
      'کد',
      'مشتری پرداخت',
      'کارمزد سانس‌چی',
      'سهم شما',
      'وضعیت',
    ],
  ];
  STATE.reservations.filter(inPeriod).forEach((r) => {
    rows.push([
      r.date || '',
      r.slotTime || '',
      r.code || '',
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
  a.download = 'sanschi-finance.csv';
  a.click();
  toast('فایل CSV دانلود شد ✓');
}

// ══════════════════════════════════════
// MOCK DATA (offline / demo preview)
// ══════════════════════════════════════
const MOCK = {
  pitches: [
    {
      _id: 'demo1',
      name: 'سالن فوتسال آریا',
      commissionAmount: 50000,
    },
    {
      _id: 'demo2',
      name: 'چمن فوتبال پارک ملت',
      commissionAmount: 80000,
    },
  ],
  reservations(pid) {
    const comm = pid === 'demo2' ? 80000 : 50000;
    const base = pid === 'demo2' ? 700000 : 650000;
    const out = [];
    const statuses = [
      'paid',
      'paid',
      'paid',
      'paid',
      'paid',
      'paid',
      'pending',
      'paid',
      'paid',
      'cancelled',
      'paid',
      'pending',
      'paid',
      'paid',
    ];
    for (let i = 0; i < statuses.length; i++) {
      const st = statuses[i];
      const peak = i % 3 === 0;
      const amount = base + (peak ? 50000 : 0) + comm;
      const days = Math.floor(i * 1.6);
      const d = new Date(Date.now() - days * 86400000);
      const jd = '1404/04/' + String(((28 - i) % 30) + 1).padStart(2, '0');
      const isPaidLike = st === 'paid' || st === 'cancelled';
      out.push({
        code: 'SNS-' + (1000 + i).toString(36).toUpperCase(),
        date: jd,
        slotTime: peak ? '۱۹:۳۰–۲۱:۰۰' : '۱۰:۳۰–۱۲:۰۰',
        amount,
        status: st,
        siteCommission: isPaidLike ? comm : null,
        pitchAmount: isPaidLike ? amount - comm : null,
        createdAt: d.toISOString(),
      });
    }
    return out;
  },
  settlements(pid) {
    const comm = pid === 'demo2' ? 80000 : 50000;
    const name = pid === 'demo2' ? 'چمن فوتبال پارک ملت' : 'سالن فوتسال آریا';
    const mk = (date, status, paidCount) => ({
      date,
      status,
      pitch: { _id: pid, name },
      grossAmount: paidCount * (700000 + comm),
      commissionAmount: paidCount * comm,
      netAmount: paidCount * 700000,
      paidCount,
    });
    return [
      mk('1404/04/01', 'paid', 6),
      mk('1404/04/08', 'approved', 4),
      mk('1404/04/15', 'pending', 5),
    ];
  },
};

// ══════════════════════════════════════
// INIT
// ══════════════════════════════════════
(async function init() {
  if (!getToken()) {
    // no token: still show demo so the page is never blank
    STATE.demo = true;
  }
  await loadPitches();
  await loadData();
  render();
  window.addEventListener('resize', () => renderChart(computeTotals()));
})();
