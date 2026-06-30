      // ═══════════════════════════════════════════
      // CONFIG / HELPERS
      // ═══════════════════════════════════════════
      const API = 'http://localhost:5000/api';

      function getToken() {
        return sessionStorage.getItem('sns_token') || '';
      }
      function authHeaders() {
        return {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + getToken(),
        };
      }
      function numFa(n) {
        return n.toString().replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
      }
      function priceFa(n) {
        return numFa((parseInt(n) || 0).toLocaleString('en'));
      }
      const typeShort = { futsal: 'فوتسال', grass: 'چمن' };
      const statusMap = {
        pending: { label: 'در انتظار پرداخت', cls: 'pending' },
        paid: { label: 'پرداخت‌شده', cls: 'paid' },
        cancelled: { label: 'لغو شده', cls: 'cancelled' },
      };

      let toastTimer;
      function toast(msg, isErr) {
        const t = document.getElementById('toast');
        t.textContent = msg;
        t.className = 'toast show' + (isErr ? ' err' : '');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
      }

      function showView(name) {
        ['login', 'empty', 'panel'].forEach((v) => {
          document
            .getElementById('view-' + v)
            .classList.toggle('active', v === name);
        });
        document.getElementById('topbarActions').style.display =
          name === 'login' ? 'none' : 'flex';
      }

      // ═══════════════════════════════════════════
      // STATE
      // ═══════════════════════════════════════════
      const STATE = { pitches: [], selectedIdx: 0, dirty: false };

      // ═══════════════════════════════════════════
      // LOGIN — موبایل + OTP  /  ایمیل + رمز
      // (همون مسیرهای API سایت اصلی، فقط تو این صفحه جدا)
      // ═══════════════════════════════════════════
      let loginMethod = 'phone';
      function setLoginMethod(m) {
        loginMethod = m;
        document
          .getElementById('tab-phone')
          .classList.toggle('active', m === 'phone');
        document
          .getElementById('tab-email')
          .classList.toggle('active', m === 'email');
        document.getElementById('flow-phone').style.display =
          m === 'phone' ? 'block' : 'none';
        document.getElementById('flow-email').style.display =
          m === 'email' ? 'block' : 'none';
      }
      window.setLoginMethod = setLoginMethod;

      let otpTimer = null;
      async function ownerSendOTP() {
        const phone = document.getElementById('ownerPhone').value.trim();
        if (!/^09[0-9]{9}$/.test(phone)) {
          showErr('ownerPhone', 'ownerPhoneErr', 'شماره موبایل معتبر نیست');
          return;
        }
        clearErr('ownerPhone', 'ownerPhoneErr');
        const btn = document.getElementById('sendOtpBtn');
        btn.disabled = true;

        try {
          const res = await fetch(`${API}/auth/send-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone }),
          });
          const data = await res.json();
          if (!data.success) throw new Error(data.message);

          document.getElementById('otpBlock').style.display = 'block';
          document.getElementById('ownerPhone').disabled = true;

          let secs = 60;
          const secEl = document.getElementById('otpSec');
          clearInterval(otpTimer);
          otpTimer = setInterval(() => {
            secs--;
            secEl.textContent = numFa(secs);
            if (secs <= 0) {
              clearInterval(otpTimer);
              document.getElementById('otpCountdown').innerHTML =
                '<span onclick="ownerResendOTP()">ارسال مجدد رمز</span>';
              btn.disabled = false;
            }
          }, 1000);

          setTimeout(
            () => document.querySelectorAll('#otpRow .otp-cell')[0].focus(),
            100,
          );

          if (data && data.dev_otp) {
            console.log(
              '%c🔑 کد OTP: ' + data.dev_otp,
              'font-size:18px;color:green;font-weight:bold;',
            );
          }
        } catch (err) {
          btn.disabled = false;
          showErr(
            'ownerPhone',
            'ownerPhoneErr',
            err.message || 'خطا در ارسال رمز',
          );
        }
      }
      window.ownerSendOTP = ownerSendOTP;

      function ownerResendOTP() {
        document.getElementById('ownerPhone').disabled = false;
        document.getElementById('otpCountdown').innerHTML =
          'ارسال مجدد پس از <strong id="otpSec">۶۰</strong> ثانیه';
        document
          .querySelectorAll('#otpRow .otp-cell')
          .forEach((c) => (c.value = ''));
        ownerSendOTP();
      }
      window.ownerResendOTP = ownerResendOTP;

      document
        .querySelectorAll('#otpRow .otp-cell')
        .forEach((cell, idx, all) => {
          cell.addEventListener('input', function () {
            this.value = this.value.replace(/\D/g, '');
            if (this.value && idx < all.length - 1) all[idx + 1].focus();
          });
          cell.addEventListener('keydown', function (e) {
            if (e.key === 'Backspace' && !this.value && idx > 0)
              all[idx - 1].focus();
          });
        });

      function showErr(inputId, errId, msg) {
        const inp = document.getElementById(inputId);
        const err = document.getElementById(errId);
        if (inp) inp.classList.add('error');
        if (err) {
          if (msg) err.textContent = msg;
          err.classList.add('show');
        }
      }
      function clearErr(inputId, errId) {
        const inp = document.getElementById(inputId);
        const err = document.getElementById(errId);
        if (inp) inp.classList.remove('error');
        if (err) err.classList.remove('show');
      }

      async function doOwnerLogin() {
        const btn = document.getElementById('ownerLoginBtn');

        if (loginMethod === 'phone') {
          const otp = [...document.querySelectorAll('#otpRow .otp-cell')]
            .map((c) => c.value)
            .join('');
          if (otp.length < 4) {
            ownerSendOTP();
            return;
          }

          btn.classList.add('loading');
          try {
            const phone = document.getElementById('ownerPhone').value.trim();
            const res = await fetch(`${API}/auth/verify-otp`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ phone, otp }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message);
            onOwnerLoginSuccess(data);
          } catch (err) {
            btn.classList.remove('loading');
            showErr(
              'ownerPhone',
              'ownerPhoneErr',
              err.message || 'خطا در ورود',
            );
          }
        } else {
          const email = document.getElementById('ownerEmail').value.trim();
          const pass = document.getElementById('ownerPass').value;
          if (!email || !pass) {
            showErr(
              'ownerPass',
              'ownerLoginErr',
              'ایمیل و رمز عبور را وارد کن',
            );
            return;
          }
          clearErr('ownerPass', 'ownerLoginErr');

          btn.classList.add('loading');
          try {
            const res = await fetch(`${API}/auth/login`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password: pass }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message);
            onOwnerLoginSuccess(data);
          } catch (err) {
            btn.classList.remove('loading');
            showErr('ownerPass', 'ownerLoginErr', err.message || 'خطا در ورود');
          }
        }
      }
      window.doOwnerLogin = doOwnerLogin;

      function onOwnerLoginSuccess(data) {
        sessionStorage.setItem('sns_token', data.token);
        sessionStorage.setItem('sns_user', JSON.stringify(data.user));
        document.getElementById('ownerLoginBtn').classList.remove('loading');
        loadMyPitches();
      }

      function ownerLogout() {
        sessionStorage.removeItem('sns_token');
        sessionStorage.removeItem('sns_user');
        STATE.pitches = [];
        showView('login');
      }
      window.ownerLogout = ownerLogout;

      // ═══════════════════════════════════════════
      // LOAD OWNER'S PITCH(ES)
      // ═══════════════════════════════════════════
      async function loadMyPitches() {
        try {
          const res = await fetch(`${API}/owner/pitches`, {
            headers: authHeaders(),
          });
          if (res.status === 401) throw new Error('expired');
          const data = await res.json();
          if (!data.success)
            throw new Error(data.message || 'خطا در دریافت اطلاعات');

          STATE.pitches = data.pitches;

          const userRaw = sessionStorage.getItem('sns_user');
          const user = userRaw ? JSON.parse(userRaw) : null;
          document.getElementById('ownerNameTop').innerHTML = user
            ? 'سلام، <strong>' + user.name + '</strong>'
            : '';

          if (!STATE.pitches.length) {
            showView('empty');
            return;
          }

          STATE.selectedIdx = 0;
          renderSwitcher();
          renderPanel();
          loadReservations();
          showView('panel');
          // Show owner-only buttons only when pitch is connected
          document
            .querySelectorAll('.owner-only-btn')
            .forEach((b) => (b.style.display = ''));
        } catch (err) {
          sessionStorage.removeItem('sns_token');
          sessionStorage.removeItem('sns_user');
          showView('login');
        }
      }

      function renderSwitcher() {
        const wrap = document.getElementById('pitchSwitcher');
        if (STATE.pitches.length <= 1) {
          wrap.style.display = 'none';
          wrap.innerHTML = '';
          return;
        }
        wrap.style.display = 'flex';
        wrap.innerHTML = STATE.pitches
          .map(
            (p, i) =>
              `<button class="pitch-tab ${i === STATE.selectedIdx ? 'active' : ''}" onclick="switchPitch(${i})">${p.name}</button>`,
          )
          .join('');
      }

      function switchPitch(i) {
        if (
          STATE.dirty &&
          !confirm('تغییرات ذخیره‌نشده‌ای داری. بدون ذخیره برم سراغ زمین بعدی؟')
        )
          return;
        STATE.selectedIdx = i;
        renderSwitcher();
        renderPanel();
        loadReservations();
      }
      window.switchPitch = switchPitch;

      // ═══════════════════════════════════════════
      // RENDER PITCH PANEL
      // ═══════════════════════════════════════════
      function currentPitch() {
        return STATE.pitches[STATE.selectedIdx];
      }

      function renderPanel() {
        const p = currentPitch();
        if (!p) return;

        document.getElementById('pitchHeadName').textContent = p.name;
        document.getElementById('pitchHeadSub').textContent =
          typeShort[p.type] +
          ' · ' +
          numFa(p.size) +
          ' نفره · ' +
          numFa(p.avail || 0) +
          ' سانس خالی';

        const thumb = document.getElementById('pitchThumb');
        thumb.innerHTML = p.image ? `<img src="${p.image}">` : '🏟️';

        document.getElementById('activeToggle').className =
          'toggle-switch' + (p.isActive ? ' on' : '');

        document.getElementById('inpName').value = p.name || '';
        document.getElementById('inpType').value = p.type || 'futsal';
        document.getElementById('inpSize').value = p.size || 5;
        document.getElementById('inpPrice').value = p.price || 0;
        document.getElementById('inpAddress').value = p.address || '';
        document.getElementById('inpDesc').value = p.desc || '';
        document.getElementById('inpTags').value = (p.tags || []).join('، ');

        const imgPreview = document.getElementById('imgPreview');
        const imgPh = document.getElementById('imgPlaceholder');
        if (p.image) {
          imgPreview.src = p.image;
          imgPreview.style.display = 'block';
          imgPh.style.display = 'none';
        } else {
          imgPreview.style.display = 'none';
          imgPh.style.display = 'block';
        }

        renderSlotsTable();
        setSaveStatus(false);
      }

      function renderSlotsTable() {
        const p = currentPitch();
        const tbody = document.getElementById('slotsBody');
        tbody.innerHTML = (p.slots || [])
          .map((s, i) => {
            const isPeak = (s.price || 0) >= 700000;
            return `<tr>
        <td>${numFa(i + 1)}</td>
        <td><input class="cfg-input slot-time-inp" value="${s.time}" oninput="updateSlotField(${i},'time',this.value)"></td>
        <td><input class="cfg-input slot-price-inp" type="number" step="10000" value="${s.price}" oninput="updateSlotField(${i},'price',parseInt(this.value)||0)"></td>
        <td><button class="slot-status-btn ${s.taken ? 'taken' : ''}" onclick="toggleSlotTaken(${i})">${s.taken ? '🔴 رزرو' : isPeak ? '🟡 خالی' : '🟢 خالی'}</button></td>
      </tr>`;
          })
          .join('');
      }

      function updateSlotField(i, key, val) {
        currentPitch().slots[i][key] = val;
        markDirty();
        if (key === 'price') renderSlotsTable();
      }
      window.updateSlotField = updateSlotField;

      function toggleSlotTaken(i) {
        const slot = currentPitch().slots[i];
        slot.taken = !slot.taken;
        if (!slot.taken) slot.takenBy = null;
        renderSlotsTable();
        markDirty();
      }
      window.toggleSlotTaken = toggleSlotTaken;

      function applyBulkPrice() {
        const period = document.getElementById('bulkPeriod').value;
        const price = parseInt(document.getElementById('bulkPrice').value) || 0;
        if (!price) {
          toast('قیمت را وارد کن', true);
          return;
        }
        const p = currentPitch();
        p.slots.forEach((s, i) => {
          if (period === 'all') s.price = price;
          else if (period === 'morning' && i <= 6) s.price = price;
          else if (period === 'evening' && i >= 7) s.price = price;
        });
        renderSlotsTable();
        markDirty();
        toast('قیمت‌ها در فرم به‌روز شد — یادت نره «ذخیره تغییرات» رو بزنی!');
      }
      window.applyBulkPrice = applyBulkPrice;

      function toggleActive() {
        const p = currentPitch();
        p.isActive = !p.isActive;
        document.getElementById('activeToggle').className =
          'toggle-switch' + (p.isActive ? ' on' : '');
        markDirty();
      }
      window.toggleActive = toggleActive;

      function handleImage(e) {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 4 * 1024 * 1024) {
          toast('حجم عکس باید کمتر از ۴ مگابایت باشه', true);
          return;
        }
        const reader = new FileReader();
        reader.onload = function (ev) {
          currentPitch().image = ev.target.result;
          const thumb = document.getElementById('pitchThumb');
          thumb.innerHTML = `<img src="${ev.target.result}">`;
          const preview = document.getElementById('imgPreview');
          preview.src = ev.target.result;
          preview.style.display = 'block';
          document.getElementById('imgPlaceholder').style.display = 'none';
          markDirty();
        };
        reader.readAsDataURL(file);
      }
      window.handleImage = handleImage;

      function markDirty() {
        STATE.dirty = true;
        setSaveStatus(true);
      }
      window.markDirty = markDirty;

      function setSaveStatus(dirty) {
        const el = document.getElementById('saveStatus');
        const tx = document.getElementById('saveStatusText');
        el.className = 'save-status ' + (dirty ? 'dirty' : 'saved');
        tx.textContent = dirty ? 'تغییرات ذخیره‌نشده' : 'همه تغییرات ذخیره شده';
      }

      // ═══════════════════════════════════════════
      // SAVE
      // ═══════════════════════════════════════════
      async function savePitch() {
        const p = currentPitch();
        if (!p) return;

        const name = document.getElementById('inpName').value.trim();
        const address = document.getElementById('inpAddress').value.trim();
        if (!name || !address) {
          toast('نام و آدرس زمین نمی‌تونن خالی باشن', true);
          return;
        }

        const payload = {
          name,
          type: document.getElementById('inpType').value,
          size: parseInt(document.getElementById('inpSize').value),
          price: parseInt(document.getElementById('inpPrice').value) || 0,
          address,
          desc: document.getElementById('inpDesc').value.trim(),
          tags: document
            .getElementById('inpTags')
            .value.split(/[،,]/)
            .map((t) => t.trim())
            .filter(Boolean),
          image: p.image || '',
          isActive: p.isActive,
          slots: p.slots,
        };

        try {
          const res = await fetch(`${API}/owner/pitches/${p._id}`, {
            method: 'PATCH',
            headers: authHeaders(),
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (!data.success) throw new Error(data.message || 'خطا در ذخیره');

          STATE.pitches[STATE.selectedIdx] = {
            ...data.pitch,
            avail: data.pitch.slots.filter((s) => !s.taken).length,
          };
          renderSwitcher();
          renderPanel();
          STATE.dirty = false;
          toast('✓ تغییرات با موفقیت ذخیره شد');
        } catch (err) {
          toast('❌ خطا در ذخیره: ' + err.message, true);
        }
      }
      window.savePitch = savePitch;

      // ═══════════════════════════════════════════
      // RESERVATIONS
      // ═══════════════════════════════════════════
      let _allReservations = [];

      async function loadReservations() {
        const p = currentPitch();
        const list = document.getElementById('resList');
        if (!p) return;
        list.innerHTML =
          '<div class="res-empty">در حال بارگذاری رزروها...</div>';

        try {
          const res = await fetch(
            `${API}/owner/pitches/${p._id}/reservations`,
            { headers: authHeaders() },
          );
          const data = await res.json();
          if (!data.success) throw new Error(data.message);
          _allReservations = data.reservations || [];
          filterAndRenderReservations();
          renderOwnerRevenue();
        } catch (err) {
          list.innerHTML =
            '<div class="res-empty">مشکلی در دریافت رزروها پیش اومد</div>';
        }
      }

      function filterAndRenderReservations() {
        const typeF = document.getElementById('resTypeFilter')?.value || 'all';
        const statusF =
          document.getElementById('resStatusFilter2')?.value || 'all';
        let list = _allReservations.slice();
        if (typeF === 'single') list = list.filter((r) => !r.recurringGroupId);
        if (typeF === 'recurring')
          list = list.filter((r) => !!r.recurringGroupId);
        if (statusF !== 'all') list = list.filter((r) => r.status === statusF);
        renderReservations(list);
      }

      function renderReservations(list) {
        const el = document.getElementById('resList');
        if (!list.length) {
          el.innerHTML =
            '<div class="res-empty">رزروی با این فیلتر پیدا نشد</div>';
          return;
        }

        // گروه‌بندی recurring vs single
        const groups = {};
        const singles = [];
        list.forEach((r) => {
          if (r.recurringGroupId) {
            if (!groups[r.recurringGroupId]) groups[r.recurringGroupId] = [];
            groups[r.recurringGroupId].push(r);
          } else {
            singles.push(r);
          }
        });

        let html = '';

        // ── گروه‌های تکراری ──
        Object.entries(groups).forEach(([gid, recs]) => {
          const first = recs[0];
          const active = recs.filter((r) => r.status !== 'cancelled');
          const weeks = recs.length;
          const typeLabel = weeks <= 5 ? 'ماهانه' : 'سالانه';
          const canCancel = active.length > 0;
          const totalAmount = recs.reduce((s, r) => s + (r.amount || 0), 0);
          const userName = (first.user && first.user.name) || 'کاربر';
          const userPhone = (first.user && first.user.phone) || '';

          html += `<div class="res-item" style="flex-direction:column;align-items:stretch;gap:10px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px">
              <div class="res-info">
                <h4>${userName} ${userPhone ? '· ' + userPhone : ''}</h4>
                <div class="res-meta">
                  <span>🔄 رزرو ${typeLabel}</span>
                  <span>⏰ ${first.slotTime || '—'}</span>
                  <span>👥 ${numFa(first.playerCount || 0)} نفر</span>
                  <span>${numFa(active.length)} جلسه فعال از ${numFa(weeks)} جلسه</span>
                </div>
                <div class="res-amount">${priceFa(totalAmount)} تومان کل</div>
              </div>
              <div class="res-right" style="flex-direction:column;align-items:flex-end;gap:6px">
                ${
                  canCancel
                    ? `<button class="res-action-btn cancel" onclick="cancelGroup('${gid}')">لغو همه جلسات فعال (${numFa(active.length)} جلسه)</button>`
                    : '<span style="font-size:11px;color:var(--muted)">همه جلسات لغو شده</span>'
                }
              </div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:5px;padding-top:4px;border-top:1px solid rgba(34,197,94,.07)">
              ${recs
                .map((r) => {
                  const bg =
                    r.status === 'cancelled'
                      ? 'rgba(239,68,68,.12)'
                      : r.status === 'paid'
                        ? 'rgba(34,197,94,.12)'
                        : 'rgba(245,158,11,.12)';
                  const col =
                    r.status === 'cancelled'
                      ? 'var(--red)'
                      : r.status === 'paid'
                        ? 'var(--green)'
                        : 'var(--amber)';
                  const canCancel = r.status !== 'cancelled';
                  return `<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;padding:3px 9px;border-radius:6px;background:${bg};color:${col};border:1px solid ${col}">
                  ${r.date || '—'}
                  ${canCancel ? `<button onclick="setResStatus('${r._id}','cancelled')" style="background:none;border:none;cursor:pointer;color:${col};font-size:12px;line-height:1;padding:0 0 0 2px" title="لغو این جلسه">✕</button>` : ''}
                </span>`;
                })
                .join('')}
            </div>
          </div>`;
        });

        // ── جلسه‌ای‌ها ──
        singles.forEach((r) => {
          const status = statusMap[r.status] || statusMap.pending;
          const userName = (r.user && r.user.name) || 'کاربر';
          const userPhone = (r.user && r.user.phone) || '';
          const pitchCommission = currentPitch()
            ? currentPitch().commissionAmount || 0
            : 0;
          const commission =
            r.siteCommission != null ? r.siteCommission : pitchCommission;
          const netAmount =
            r.pitchAmount != null
              ? r.pitchAmount
              : Math.max(0, (r.amount || 0) - commission);
          let actions = '';
          if (r.status === 'pending') {
            actions = `
              <button class="res-action-btn confirm" onclick="setResStatus('${r._id}','paid')">تایید پرداخت</button>
              <button class="res-action-btn cancel" onclick="setResStatus('${r._id}','cancelled')">لغو رزرو</button>`;
          } else if (r.status === 'paid') {
            actions = `<button class="res-action-btn cancel" onclick="setResStatus('${r._id}','cancelled')">لغو رزرو (پرداخت‌شده)</button>`;
          }

          // نمایش مالی — فقط برای رزروهای پرداختی کمیسیون نشون بده
          const financeHtml =
            r.status === 'paid'
              ? `
            <div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap">
              <span style="font-size:11px;padding:2px 8px;border-radius:6px;background:rgba(239,68,68,.1);color:var(--red);border:1px solid rgba(239,68,68,.25)">
                🏷️ کمیسیون: ${priceFa(commission)} ت
              </span>
              <span style="font-size:11px;padding:2px 8px;border-radius:6px;background:var(--glow);color:var(--green);border:1px solid var(--border)">
                ✅ سود شما: ${priceFa(netAmount)} ت
              </span>
            </div>`
              : '';

          html += `<div class="res-item">
            <div class="res-info">
              <h4>${userName} ${userPhone ? '· ' + userPhone : ''}</h4>
              <div class="res-meta">
                <span>📅 ${r.date || '—'}</span>
                <span>⏰ ${r.slotTime || '—'}</span>
                <span>👥 ${numFa(r.playerCount || 0)} نفر</span>
              </div>
              <div class="res-amount">${priceFa(r.amount)} تومان (کل دریافتی)</div>
              ${financeHtml}
            </div>
            <div class="res-right">
              <span class="res-status ${status.cls}">${status.label}</span>
              ${actions}
            </div>
          </div>`;
        });

        el.innerHTML = html;
      }

      async function cancelGroup(groupId) {
        if (!confirm('همه جلسات فعال این گروه لغو بشن؟ سانس‌ها آزاد می‌شن.'))
          return;
        try {
          const res = await fetch(
            `${API}/owner/reservations/group/${groupId}`,
            {
              method: 'DELETE',
              headers: authHeaders(),
            },
          );
          const data = await res.json();
          if (!data.success) throw new Error(data.message);
          toast(`✓ ${numFa(data.cancelled)} جلسه لغو شد`);
          await loadMyPitches();
          loadReservations();
        } catch (err) {
          toast('❌ ' + err.message, true);
        }
      }
      window.cancelGroup = cancelGroup;

      async function setResStatus(id, status) {
        const msg =
          status === 'paid'
            ? 'تایید پرداخت این رزرو؟'
            : 'لغو این رزرو و آزاد کردن سانس؟';
        if (!confirm(msg)) return;
        try {
          let res, data;
          if (status === 'cancelled') {
            // از route DELETE owner استفاده می‌کنیم که سانس رو آزاد می‌کنه
            res = await fetch(`${API}/owner/reservations/${id}`, {
              method: 'DELETE',
              headers: authHeaders(),
            });
          } else {
            res = await fetch(`${API}/owner/reservations/${id}/status`, {
              method: 'PATCH',
              headers: authHeaders(),
              body: JSON.stringify({ status }),
            });
          }
          data = await res.json();
          if (!data.success) throw new Error(data.message);
          toast(status === 'paid' ? '✓ پرداخت تایید شد' : '✓ رزرو لغو شد');
          await loadMyPitches();
          loadReservations();
        } catch (err) {
          toast('❌ ' + err.message, true);
        }
      }
      window.setResStatus = setResStatus;

      // ═══════════════════════════════════════════
      // ═══════════════════════════════════════════
      // REVENUE PANEL (owner)
      // ═══════════════════════════════════════════
      function jalaliToDateOwner(str) {
        if (!str) return null;
        const parts = str.split('/');
        if (parts.length < 3) return null;
        const [jy, jm, jd] = parts.map(Number);
        let jy2 = jy - 979,
          jm2 = jm - 1,
          jd2 = jd - 1;
        let j_day_no =
          365 * jy2 +
          Math.floor(jy2 / 33) * 8 +
          Math.floor(((jy2 % 33) + 3) / 4);
        for (let i = 0; i < jm2; i++) j_day_no += i < 6 ? 31 : 30;
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
        const leap = g_day_no < 366;
        if (!leap) {
          g_day_no--;
          gy2 += Math.floor(g_day_no / 365);
          g_day_no = g_day_no % 365;
        }
        const ml = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        let gm2 = 0;
        for (; gm2 < 12 && g_day_no >= ml[gm2]; gm2++) g_day_no -= ml[gm2];
        return new Date(gy2, gm2, g_day_no + 1);
      }

      function getOwnerPeriodRange() {
        const period =
          document.getElementById('ownerRevPeriod')?.value || 'all';
        const now = new Date();
        const start = new Date(now);
        if (period === 'all') {
          start.setFullYear(2000, 0, 1);
          start.setHours(0, 0, 0, 0);
        } else if (period === 'day') start.setHours(0, 0, 0, 0);
        else if (period === 'week') {
          start.setDate(now.getDate() - now.getDay());
          start.setHours(0, 0, 0, 0);
        } else if (period === 'month') {
          start.setDate(1);
          start.setHours(0, 0, 0, 0);
        } else {
          start.setMonth(0, 1);
          start.setHours(0, 0, 0, 0);
        }
        return { period, start, end: new Date(now) };
      }

      function renderOwnerRevenue() {
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

        function resetZero() {
          document.getElementById('oGross').textContent = priceFa(0);
          document.getElementById('oCommission').textContent = priceFa(0);
          document.getElementById('oCommissionSub').textContent = 'تومان';
          document.getElementById('oNet').textContent = priceFa(0);
          document.getElementById('oRev').textContent = priceFa(0);
          document.getElementById('oPaid').textContent = numFa(0);
          document.getElementById('oPending').textContent = numFa(0);
          document.getElementById('oAvg').textContent = priceFa(0);
          const canvas = document.getElementById('ownerRevChart');
          if (canvas)
            drawOwnerBarChart(
              canvas,
              jMonths,
              Array(12).fill(0),
              Array(12).fill(0),
            );
        }

        if (!_allReservations.length) {
          resetZero();
          return;
        }

        const { period, start, end } = getOwnerPeriodRange();

        const filtered = _allReservations.filter((r) => {
          if (period === 'all') return true;
          const d = r.createdAt
            ? new Date(r.createdAt)
            : jalaliToDateOwner(r.date);
          if (!d) return true;
          return d >= start && d <= end;
        });

        const paid = filtered.filter((r) => r.status === 'paid');
        const pending = filtered.filter((r) => r.status === 'pending');

        // ── محاسبه مالی دقیق ──
        // اگه pitchAmount روی رزرو ثبت شده (بعد از پرداخت snapshot شده) استفاده کن
        // وگرنه fallback به commissionAmount زمین فعلی
        const pitchCommission = currentPitch()
          ? currentPitch().commissionAmount || 0
          : 0;

        const totalGross = paid.reduce((s, r) => s + (r.amount || 0), 0);
        const totalCommission = paid.reduce((s, r) => {
          if (r.siteCommission != null) return s + r.siteCommission;
          return s + pitchCommission; // fallback
        }, 0);
        const totalNet = paid.reduce((s, r) => {
          if (r.pitchAmount != null) return s + r.pitchAmount;
          return s + Math.max(0, (r.amount || 0) - pitchCommission);
        }, 0);
        const avgNet = paid.length ? Math.round(totalNet / paid.length) : 0;

        // ── به‌روزرسانی خلاصه مالی ──
        document.getElementById('oGross').textContent = priceFa(totalGross);
        document.getElementById('oCommission').textContent =
          priceFa(totalCommission);
        document.getElementById('oCommissionSub').textContent = paid.length
          ? numFa(paid.length) + ' رزرو × ' + priceFa(pitchCommission) + ' ت'
          : 'تومان';
        document.getElementById('oNet').textContent = priceFa(totalNet);

        // ── متریک‌های پایین ──
        document.getElementById('oRev').textContent = priceFa(totalGross);
        document.getElementById('oPaid').textContent = numFa(paid.length);
        document.getElementById('oPending').textContent = numFa(pending.length);
        document.getElementById('oAvg').textContent = priceFa(avgNet);

        const periodLabels = {
          all: 'همه زمان‌ها',
          day: 'امروز',
          week: 'این هفته',
          month: 'این ماه',
          year: 'این سال',
        };
        document.getElementById('oChartTitle').textContent =
          'نمودار سود خالص — ' + (periodLabels[period] || 'همه');

        // نمودار بر اساس سود خالص (نه gross)
        renderOwnerChart(filtered, paid, pending, period, pitchCommission);
      }

      function renderOwnerChart(
        filtered,
        paid,
        pending,
        period,
        pitchCommission,
      ) {
        const canvas = document.getElementById('ownerRevChart');
        if (!canvas) return;
        pitchCommission = pitchCommission || 0;

        // تابع کمکی: سود خالص یک رزرو
        function netOf(r) {
          if (r.pitchAmount != null) return r.pitchAmount;
          return Math.max(0, (r.amount || 0) - pitchCommission);
        }

        let labels = [],
          paidData = [],
          pendingData = [];
        const now = new Date();

        if (period === 'all') {
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
          paidData = Array(12).fill(0);
          pendingData = Array(12).fill(0);
          paid.forEach((r) => {
            const d = r.createdAt
              ? new Date(r.createdAt)
              : jalaliToDateOwner(r.date);
            if (d) paidData[d.getMonth()] += netOf(r);
          });
          pending.forEach((r) => {
            const d = r.createdAt
              ? new Date(r.createdAt)
              : jalaliToDateOwner(r.date);
            if (d) pendingData[d.getMonth()] += r.amount || 0;
          });
        } else if (period === 'day') {
          labels = Array.from({ length: 18 }, (_, i) => numFa(i + 6) + ':۰۰');
          paidData = Array(18).fill(0);
          pendingData = Array(18).fill(0);
          paid.forEach((r) => {
            const d = r.createdAt
              ? new Date(r.createdAt)
              : jalaliToDateOwner(r.date);
            if (!d) return;
            const h = d.getHours() - 6;
            if (h >= 0 && h < 18) paidData[h] += netOf(r);
          });
          pending.forEach((r) => {
            const d = r.createdAt
              ? new Date(r.createdAt)
              : jalaliToDateOwner(r.date);
            if (!d) return;
            const h = d.getHours() - 6;
            if (h >= 0 && h < 18) pendingData[h] += r.amount || 0;
          });
        } else if (period === 'week') {
          labels = [
            'یکشنبه',
            'دوشنبه',
            'سه‌شنبه',
            'چهارشنبه',
            'پنجشنبه',
            'جمعه',
            'شنبه',
          ];
          paidData = Array(7).fill(0);
          pendingData = Array(7).fill(0);
          paid.forEach((r) => {
            const d = jalaliToDateOwner(r.date) || new Date(r.createdAt);
            paidData[d.getDay()] += netOf(r);
          });
          pending.forEach((r) => {
            const d = jalaliToDateOwner(r.date) || new Date(r.createdAt);
            pendingData[d.getDay()] += r.amount || 0;
          });
        } else if (period === 'month') {
          const days = new Date(
            now.getFullYear(),
            now.getMonth() + 1,
            0,
          ).getDate();
          labels = Array.from({ length: days }, (_, i) => numFa(i + 1));
          paidData = Array(days).fill(0);
          pendingData = Array(days).fill(0);
          paid.forEach((r) => {
            const d = jalaliToDateOwner(r.date) || new Date(r.createdAt);
            if (d.getMonth() === now.getMonth())
              paidData[d.getDate() - 1] += netOf(r);
          });
          pending.forEach((r) => {
            const d = jalaliToDateOwner(r.date) || new Date(r.createdAt);
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
          paidData = Array(12).fill(0);
          pendingData = Array(12).fill(0);
          paid.forEach((r) => {
            const d = jalaliToDateOwner(r.date) || new Date(r.createdAt);
            paidData[d.getMonth()] += netOf(r);
          });
          pending.forEach((r) => {
            const d = jalaliToDateOwner(r.date) || new Date(r.createdAt);
            pendingData[d.getMonth()] += r.amount || 0;
          });
        }

        drawOwnerBarChart(canvas, labels, paidData, pendingData);
      }

      function drawOwnerBarChart(canvas, labels, paidData, pendingData) {
        // اگه canvas هنوز render نشده، یه frame صبر کن
        if (!canvas.offsetWidth) {
          requestAnimationFrame(() =>
            drawOwnerBarChart(canvas, labels, paidData, pendingData),
          );
          return;
        }
        const ctx = canvas.getContext('2d');
        const W =
          canvas.offsetWidth || canvas.parentElement?.offsetWidth || 500;
        const H = 160;
        canvas.width = W;
        canvas.height = H;
        ctx.clearRect(0, 0, W, H);

        const maxVal = Math.max(...paidData, ...pendingData, 1);
        const padL = 8,
          padR = 8,
          padT = 14,
          padB = 26;
        const chartW = W - padL - padR,
          chartH = H - padT - padB;
        const n = labels.length;
        const groupW = chartW / n;
        const barW = Math.max(3, groupW * 0.35);
        const gap = Math.max(1, groupW * 0.08);

        for (let i = 0; i <= 4; i++) {
          const y = padT + chartH - (chartH * i) / 4;
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(34,197,94,0.07)';
          ctx.lineWidth = 1;
          ctx.moveTo(padL, y);
          ctx.lineTo(W - padR, y);
          ctx.stroke();
        }

        paidData.forEach((v, i) => {
          const x = padL + i * groupW;
          if (v > 0) {
            const bH = Math.max(3, (v / maxVal) * chartH);
            ctx.fillStyle = '#22c55e';
            ctx.fillRect(x + gap, padT + chartH - bH, barW, bH);
          }
          const pv = pendingData[i] || 0;
          if (pv > 0) {
            const pH = Math.max(3, (pv / maxVal) * chartH);
            ctx.fillStyle = '#f59e0b';
            ctx.fillRect(x + gap + barW + 2, padT + chartH - pH, barW, pH);
          }
        });

        const step = n > 14 ? Math.ceil(n / 10) : 1;
        ctx.fillStyle = 'rgba(63,102,80,0.85)';
        ctx.font = `${Math.max(8, Math.min(10, Math.floor(groupW * 0.55)))}px Vazirmatn,sans-serif`;
        ctx.textAlign = 'center';
        labels.forEach((lbl, i) => {
          if (i % step !== 0) return;
          ctx.fillText(lbl, padL + i * groupW + groupW / 2, H - 6);
        });
      }

      // INIT
      // ═══════════════════════════════════════════
      if (getToken()) {
        loadMyPitches();
      } else {
        showView('login');
      }

      // ── درخواست تسویه ──
      function requestSettlement(btn) {
        const date = prompt('تاریخ تسویه را وارد کنید (مثال: 1403/03/24):');
        if (!date) return;

        if (!btn)
          btn = document.querySelector(
            '.logout-btn[onclick*="requestSettlement"]',
          );
        btn.textContent = '⏳ در حال ارسال...';
        btn.disabled = true;

        fetch(API + '/settlements/request', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ date }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (!data.success) throw new Error(data.message);
            if (data.created && data.created.length) {
              let msg = '✅ ' + data.message + '\n\n';
              data.created.forEach((s) => {
                msg += '🏟️ ' + s.pitchName + '\n';
                msg += '   ناخالص: ' + priceFa(s.grossAmount) + '\n';
                msg += '   کمیسیون: ' + priceFa(s.commissionAmount) + '\n';
                msg += '   خالص: ' + priceFa(s.netAmount) + '\n';
                msg +=
                  '   رزروها: ' +
                  s.paidCount +
                  ' فعال / ' +
                  s.voidedCount +
                  ' لغو\n\n';
              });
              alert(msg);
            } else {
              alert('⚠️ ' + data.message);
            }
            if (typeof loadSettlements === 'function') loadSettlements();
          })
          .catch((err) => {
            alert('❌ ' + err.message);
          })
          .finally(() => {
            btn.textContent = '📤 درخواست تسویه';
            btn.disabled = false;
          });
      }
    
