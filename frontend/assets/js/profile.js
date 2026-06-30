      const API = 'http://localhost:5000/api';
      const token = sessionStorage.getItem('sns_token');

      if (!token) {
        window.location.href = './login.html?redirect=profile';
      }

      function numFa(n) {
        return n.toString().replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
      }
      function priceFa(n) {
        return numFa((n || 0).toLocaleString('en'));
      }

      const typeLabel = { futsal: 'فوتسال', grass: 'چمن' };
      const statusMap = {
        pending: { label: 'در انتظار پرداخت', cls: 'pending' },
        paid: { label: 'پرداخت‌شده', cls: 'paid' },
        cancelled: { label: 'لغو شده', cls: 'cancelled' },
      };

      let currentUser = null;

      /* ── LOAD PROFILE ── */
      async function loadProfile() {
        try {
          const res = await fetch(`${API}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          if (!data.success)
            throw new Error(data.message || 'خطا در دریافت اطلاعات');

          currentUser = data.user;
          sessionStorage.setItem('sns_user', JSON.stringify(data.user));
          renderProfile(data.user);
        } catch (err) {
          sessionStorage.removeItem('sns_token');
          sessionStorage.removeItem('sns_user');
          window.location.href = './login.html?redirect=profile';
        }
      }

      function renderProfile(user) {
        const name = user.name || 'کاربر';
        document.getElementById('avatarLetter').textContent =
          name.trim().charAt(0) || '👤';
        document.getElementById('pName').textContent = name;
        document.getElementById('heroName').textContent =
          name.split(' ')[0] || name;

        const roleEl = document.getElementById('pRole');
        if (user.role === 'admin') {
          roleEl.textContent = '👑 ادمین';
          roleEl.classList.add('admin');
        } else {
          roleEl.textContent = 'کاربر عادی';
          roleEl.classList.remove('admin');
        }

        document.getElementById('pPhone').textContent = user.phone || '—';

        const emailEl = document.getElementById('pEmail');
        if (user.email) {
          emailEl.textContent = user.email;
          emailEl.classList.remove('empty');
        } else {
          emailEl.textContent = 'ثبت نشده';
          emailEl.classList.add('empty');
        }

        // fill edit form
        document.getElementById('editName').value = user.name || '';
        document.getElementById('editEmail').value = user.email || '';
        document.getElementById('editPhone').value = user.phone || '';
      }

      /* ── EDIT MODE ── */
      function toggleEdit() {
        const editForm = document.getElementById('editForm');
        const infoView = document.getElementById('infoView');
        const editBtn = document.getElementById('editToggleBtn');
        const editActs = document.getElementById('editActions');
        const saveMsg = document.getElementById('saveMsg');

        const isEditing = editForm.classList.contains('show');

        if (isEditing) {
          // cancel -> reset values
          if (currentUser) {
            document.getElementById('editName').value = currentUser.name || '';
            document.getElementById('editEmail').value =
              currentUser.email || '';
          }
          editForm.classList.remove('show');
          infoView.style.display = 'flex';
          editBtn.style.display = 'block';
          editActs.style.display = 'none';
          saveMsg.className = 'save-msg';
        } else {
          editForm.classList.add('show');
          infoView.style.display = 'none';
          editBtn.style.display = 'none';
          editActs.style.display = 'flex';
          saveMsg.className = 'save-msg';
        }
      }

      /* ── SAVE PROFILE ── */
      async function saveProfile() {
        const name = document.getElementById('editName').value.trim();
        const email = document.getElementById('editEmail').value.trim();
        const saveMsg = document.getElementById('saveMsg');
        const saveBtn = document.getElementById('saveBtn');

        if (name.length < 3) {
          saveMsg.textContent = 'نام باید حداقل ۳ کاراکتر باشد';
          saveMsg.className = 'save-msg err';
          return;
        }
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          saveMsg.textContent = 'ایمیل معتبر نیست';
          saveMsg.className = 'save-msg err';
          return;
        }

        saveBtn.classList.add('loading');
        saveBtn.disabled = true;

        try {
          const res = await fetch(`${API}/auth/me`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ name, email: email || null }),
          });
          const data = await res.json();
          if (!data.success)
            throw new Error(data.message || 'خطا در ذخیره اطلاعات');

          currentUser = data.user;
          sessionStorage.setItem('sns_user', JSON.stringify(data.user));
          renderProfile(data.user);

          saveMsg.textContent = '✓ اطلاعات با موفقیت ذخیره شد';
          saveMsg.className = 'save-msg ok';

          setTimeout(() => toggleEdit(), 900);
        } catch (err) {
          saveMsg.textContent = err.message || 'خطا در ذخیره اطلاعات';
          saveMsg.className = 'save-msg err';
        } finally {
          saveBtn.classList.remove('loading');
          saveBtn.disabled = false;
        }
      }

      /* ── MOCK RESERVATIONS (sessionStorage) ── */
      function getMockReservations() {
        try {
          const raw = JSON.parse(
            sessionStorage.getItem('sns_mock_reservations') || '[]',
          );
          // نگاشت ساختار mock به همون شکلی که renderReservations انتظار دارد
          return raw.map((r) => ({
            _id: r.id,
            isMock: true,
            pitch: { name: r.pitchName || r.pitch || 'زمین نامشخص' },
            date: r.date || '',
            slotTime: r.slotTime || '',
            code: r.code || '',
            amount: r.amount || 0,
            playerCount: r.playerCount || 0,
            status: r.status || 'pending',
            createdAt: r.createdAt || new Date().toISOString(),
          }));
        } catch (e) {
          return [];
        }
      }

      function saveMockReservations(list) {
        try {
          sessionStorage.setItem(
            'sns_mock_reservations',
            JSON.stringify(
              list.map((r) => ({
                id: r._id,
                code: r.code,
                pitchName: r.pitch && r.pitch.name,
                slotTime: r.slotTime,
                date: r.date,
                playerCount: r.playerCount,
                amount: r.amount,
                status: r.status,
                createdAt: r.createdAt,
              })),
            ),
          );
        } catch (e) {}
      }

      /* ── LOAD RESERVATIONS ── */
      async function loadReservations() {
        const list = document.getElementById('resList');
        let apiReservations = [];
        let apiFailed = false;

        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 4000);
          const res = await fetch(`${API}/reservations/my`, {
            signal: controller.signal,
            headers: { Authorization: `Bearer ${token}` },
          });
          clearTimeout(timeout);
          const data = await res.json();
          if (!data.success)
            throw new Error(data.message || 'خطا در دریافت رزروها');
          apiReservations = data.reservations || [];
        } catch (err) {
          apiFailed = true;
        }

        const mockReservations = getMockReservations();
        const all = [...apiReservations, ...mockReservations].sort(
          (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
        );

        if (apiFailed && !mockReservations.length) {
          list.innerHTML = `
      <div class="res-empty">
        <h4>مشکلی در دریافت رزروها پیش اومد</h4>
        <p>لطفاً دوباره تلاش کن</p>
      </div>`;
          document.getElementById('statTotal').textContent = numFa(0);
          document.getElementById('statPaid').textContent = numFa(0);
          document.getElementById('statPending').textContent = numFa(0);
          document.getElementById('statCancelled').textContent = numFa(0);
          return;
        }

        renderStats(all);
        renderReservations(all);
      }

      function renderStats(reservations) {
        const total = reservations.length;
        const paid = reservations.filter((r) => r.status === 'paid').length;
        const pending = reservations.filter(
          (r) => r.status === 'pending',
        ).length;
        const cancelled = reservations.filter(
          (r) => r.status === 'cancelled',
        ).length;

        document.getElementById('statTotal').textContent = numFa(total);
        document.getElementById('statPaid').textContent = numFa(paid);
        document.getElementById('statPending').textContent = numFa(pending);
        document.getElementById('statCancelled').textContent = numFa(cancelled);
      }

      function renderReservations(reservations) {
        const list = document.getElementById('resList');

        if (!reservations.length) {
          list.innerHTML = `
      <div class="res-empty">
        <h4>هنوز رزروی ثبت نکردی</h4>
        <p>برو یه زمین خوب پیدا کن و اولین سانس‌ت رو رزرو کن!</p>
        <a href="./reserve.html">رزرو سانس →</a>
      </div>`;
          return;
        }

        // newest first (already sorted in loadReservations)
        list.innerHTML = reservations
          .map((r) => {
            const pitch = r.pitch || {};
            const status = statusMap[r.status] || statusMap.pending;
            const typeText = pitch.type
              ? `${typeLabel[pitch.type] || pitch.type}${pitch.size ? ' · ' + numFa(pitch.size) + ' نفره' : ''}`
              : '';
            const cancelHandler = r.isMock
              ? `cancelMockReservation('${r._id}')`
              : `cancelReservation('${r._id}')`;

            let actionBtn = '';
            if (r.status === 'pending') {
              const params = new URLSearchParams({
                reservationId: r._id,
                code: r.code || '',
                pitchName: pitch.name || '',
                pitchType: typeText,
                date: r.date || '',
                time: r.slotTime || '',
                name: (currentUser && currentUser.name) || '',
                phone: (currentUser && currentUser.phone) || '',
                count: r.playerCount || '',
                amount: r.amount || 0,
              });
              actionBtn = `<a class="res-pay-btn" href="./payment.html?${params.toString()}">تکمیل پرداخت</a>`;
            } else if (r.status === 'paid') {
              actionBtn = `<button class="res-cancel-btn" disabled style="opacity:.4;cursor:not-allowed" title="رزرو پرداخت‌شده قابل لغو نیست">لغو رزرو</button>`;
            }

            let cancelBtn = '';
            if (r.status === 'pending') {
              cancelBtn = `<button class="res-cancel-btn" onclick="${cancelHandler}">لغو رزرو</button>`;
            }

            return `
      <div class="res-item">
        <div class="res-info">
          <h4>${pitch.name || 'زمین نامشخص'}</h4>
          <div class="res-meta">
            ${typeText ? `<span class="res-meta-item">🏟️ ${typeText}</span>` : ''}
            <span class="res-meta-item">📅 ${r.date || '—'}</span>
            <span class="res-meta-item">⏰ ${r.slotTime || '—'}</span>
          </div>
          <div class="res-code">${r.code || ''}</div>
          <div class="res-amount">${priceFa(r.amount)} تومان</div>
        </div>
        <div class="res-right">
          <span class="res-status ${status.cls}">${status.label}</span>
          <div style="display:flex;gap:8px">
            ${actionBtn}
            ${cancelBtn}
          </div>
        </div>
      </div>`;
          })
          .join('');
      }

      /* ── CANCEL RESERVATION ── */
      async function cancelReservation(id) {
        if (!confirm('آیا از لغو این رزرو مطمئنی؟')) return;

        try {
          const res = await fetch(`${API}/reservations/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          if (!data.success) throw new Error(data.message || 'خطا در لغو رزرو');

          await loadReservations();
        } catch (err) {
          alert(err.message || 'خطا در لغو رزرو');
        }
      }

      /* ── CANCEL MOCK RESERVATION ── */
      async function cancelMockReservation(id) {
        if (!confirm('آیا از لغو این رزرو مطمئنی؟')) return;

        const list = getMockReservations().map((r) => {
          if (r._id === id) r.status = 'cancelled';
          return r;
        });
        saveMockReservations(list);
        await loadReservations();
      }

      /* ── LOGOUT ── */
      function logout() {
        sessionStorage.removeItem('sns_token');
        sessionStorage.removeItem('sns_user');
        window.location.href = './index.html';
      }

      /* ── INIT ── */
      (async function init() {
        await loadProfile();
        await loadReservations();
      })();
    
