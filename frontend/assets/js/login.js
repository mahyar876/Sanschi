      function numFa(n) {
        return n.toString().replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
      }

      /* ── TABS ── */
      function switchTab(tab) {
        document.querySelectorAll('.auth-tab').forEach((t, i) => {
          t.classList.toggle(
            'active',
            (i === 0 && tab === 'login') || (i === 1 && tab === 'register'),
          );
        });
        document
          .getElementById('panel-login')
          .classList.toggle('active', tab === 'login');
        document
          .getElementById('panel-register')
          .classList.toggle('active', tab === 'register');
      }

      /* ── LOGIN METHOD ── */
      let loginMethod = 'phone';
      function setMethod(m) {
        loginMethod = m;
        document
          .getElementById('method-phone')
          .classList.toggle('active', m === 'phone');
        document
          .getElementById('method-email')
          .classList.toggle('active', m === 'email');
        document.getElementById('login-phone-flow').style.display =
          m === 'phone' ? 'block' : 'none';
        document.getElementById('login-email-flow').style.display =
          m === 'email' ? 'block' : 'none';
      }

      /* ── TOGGLE PASSWORD ── */
      function togglePw(id, btn) {
        const inp = document.getElementById(id);
        inp.type = inp.type === 'password' ? 'text' : 'password';
        btn.textContent = inp.type === 'password' ? '👁' : '🙈';
      }

      /* ── OTP SEND ── */
      let otpSent = false;
      let otpTimer = null;

      async function sendOTP() {
        const phone = document.getElementById('loginPhone').value.trim();
        if (!/^09[0-9]{9}$/.test(phone)) {
          showErr('loginPhone', 'loginPhoneErr', 'شماره موبایل معتبر نیست');
          return;
        }
        clearErr('loginPhone', 'loginPhoneErr');

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

          // نمایش فیلد OTP
          document.getElementById('otpBlock').style.display = 'block';
          document.getElementById('loginPhone').disabled = true;

          // کانتدان
          let secs = 60;
          const secEl = document.getElementById('otpSec');
          clearInterval(otpTimer);
          otpTimer = setInterval(() => {
            secs--;
            secEl.textContent = numFa(secs);
            if (secs <= 0) {
              clearInterval(otpTimer);
              document.getElementById('otpCountdown').innerHTML =
                '<span onclick="resendOTP()">ارسال مجدد رمز</span>';
              btn.disabled = false;
            }
          }, 1000);

          setTimeout(
            () =>
              document.querySelectorAll('#loginOtpRow .otp-cell')[0].focus(),
            100,
          );

          // OTP فقط تو console ترمینال چاپ میشه
          if (data && data.dev_otp) {
            console.log('');
            console.log(
              '%c🔑 کد OTP: ' + data.dev_otp,
              'font-size:20px;color:green;font-weight:bold;',
            );
            console.log('');
          }
        } catch (err) {
          btn.disabled = false;
          const msg = err.message || 'خطا در ارسال رمز';
          showErr(
            'loginPhone',
            'loginPhoneErr',
            msg.includes('ثبت‌نام')
              ? '⚠️ این شماره ثبت‌نام نشده — برو ثبت‌نام کن'
              : msg,
          );
        }
      }

      function resendOTP() {
        document.getElementById('loginPhone').disabled = false;
        document.getElementById('otpCountdown').innerHTML =
          'ارسال مجدد پس از <strong id="otpSec">۶۰</strong> ثانیه';
        document
          .querySelectorAll('#loginOtpRow .otp-cell')
          .forEach((c) => (c.value = ''));
        sendOTP();
      }

      /* ── OTP CELL NAVIGATION ── */
      document
        .querySelectorAll('#loginOtpRow .otp-cell')
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

      const API = 'http://localhost:5000/api';

      /* ── نمایش خطا ── */
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

      /* ── DO LOGIN ── */
      async function doLogin() {
        const btn = document.getElementById('loginBtn');

        if (loginMethod === 'phone') {
          // ─── ورود با OTP ───
          const otp = [...document.querySelectorAll('#loginOtpRow .otp-cell')]
            .map((c) => c.value)
            .join('');
          if (otp.length < 4) {
            sendOTP();
            return;
          }

          btn.classList.add('loading');
          try {
            const phone = document.getElementById('loginPhone').value.trim();
            const res = await fetch(`${API}/auth/verify-otp`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ phone, otp }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message);
            onLoginSuccess(data);
          } catch (err) {
            btn.classList.remove('loading');
            showErr(
              'loginPhone',
              'loginPhoneErr',
              err.message || 'خطا در ورود',
            );
          }
        } else {
          // ─── ورود با ایمیل + رمز ───
          const email = document.getElementById('loginEmail').value.trim();
          const pass = document.getElementById('loginPass').value;
          let ok = true;

          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showErr('loginEmail', 'loginEmailErr');
            ok = false;
          } else clearErr('loginEmail', 'loginEmailErr');
          if (!pass) {
            showErr('loginPass', 'loginPassErr');
            ok = false;
          } else clearErr('loginPass', 'loginPassErr');
          if (!ok) return;

          btn.classList.add('loading');
          try {
            const res = await fetch(`${API}/auth/login`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password: pass }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message);
            onLoginSuccess(data);
          } catch (err) {
            btn.classList.remove('loading');
            showErr(
              'loginEmail',
              'loginEmailErr',
              err.message || 'خطا در ورود',
            );
          }
        }
      }

      /* ── PASSWORD STRENGTH ── */
      function checkPassStrength(val) {
        const el = document.getElementById('passStrength');
        if (!val) {
          el.style.display = 'none';
          return;
        }
        el.style.display = 'block';

        let score = 0;
        if (val.length >= 8) score++;
        if (/[A-Z]/.test(val) || /[a-z]/.test(val)) score++;
        if (/\d/.test(val)) score++;
        if (/[^A-Za-z0-9]/.test(val)) score++;

        const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e'];
        const labels = ['خیلی ضعیف', 'ضعیف', 'متوسط', 'قوی'];
        for (let i = 1; i <= 4; i++) {
          const bar = document.getElementById('ps' + i);
          bar.style.background =
            i <= score ? colors[score - 1] : 'var(--green-border)';
        }
        document.getElementById('psLabel').textContent =
          labels[score - 1] || '';
        document.getElementById('psLabel').style.color =
          colors[score - 1] || 'var(--text-muted)';
      }

      /* ── DO REGISTER ── */
      async function doRegister() {
        const name = document.getElementById('regName').value.trim();
        const phone = document.getElementById('regPhone').value.trim();
        const pass = document.getElementById('regPass').value;
        const passC = document.getElementById('regPassConfirm').value;
        const terms = document.getElementById('termsCheck').checked;
        let ok = true;

        if (name.length < 3) {
          document.getElementById('regNameErr').classList.add('show');
          document.getElementById('regName').classList.add('error');
          ok = false;
        } else {
          document.getElementById('regNameErr').classList.remove('show');
          document.getElementById('regName').classList.remove('error');
        }

        if (!/^09[0-9]{9}$/.test(phone)) {
          document.getElementById('regPhoneErr').classList.add('show');
          document.getElementById('regPhone').classList.add('error');
          ok = false;
        } else {
          document.getElementById('regPhoneErr').classList.remove('show');
          document.getElementById('regPhone').classList.remove('error');
        }

        if (pass.length < 8) {
          document.getElementById('regPassErr').classList.add('show');
          document.getElementById('regPass').classList.add('error');
          ok = false;
        } else {
          document.getElementById('regPassErr').classList.remove('show');
          document.getElementById('regPass').classList.remove('error');
        }

        if (pass !== passC) {
          document.getElementById('regPassConfirmErr').classList.add('show');
          document.getElementById('regPassConfirm').classList.add('error');
          ok = false;
        } else {
          document.getElementById('regPassConfirmErr').classList.remove('show');
          document.getElementById('regPassConfirm').classList.remove('error');
        }

        if (!terms) {
          alert('لطفاً قوانین را بپذیر');
          ok = false;
        }
        if (!ok) return;

        const btn = document.getElementById('registerBtn');
        btn.classList.add('loading');
        try {
          const res = await fetch(`${API}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name,
              phone,
              email: document.getElementById('regEmail').value.trim(),
              password: pass,
            }),
          });
          const data = await res.json();
          if (!data.success) throw new Error(data.message);
          onLoginSuccess(
            data,
            'ثبت‌نام موفق! 🎉',
            'حسابت ساخته شد. بریم رزرو کنیم!',
          );
        } catch (err) {
          btn.classList.remove('loading');
          alert(err.message || 'خطا در ثبت‌نام');
        }
      }

      /* ── onLoginSuccess — ذخیره توکن و redirect ── */
      function onLoginSuccess(
        data,
        title = 'ورود موفق! 👋',
        msg = 'خوش اومدی. داری هدایت می‌شی...',
      ) {
        // ذخیره توکن و اطلاعات کاربر
        sessionStorage.setItem('sns_token', data.token);
        sessionStorage.setItem('sns_user', JSON.stringify(data.user));

        document.getElementById('loginBtn') &&
          document.getElementById('loginBtn').classList.remove('loading');
        document.getElementById('registerBtn') &&
          document.getElementById('registerBtn').classList.remove('loading');

        document.getElementById('successTitle').textContent = title;
        document.getElementById('successMsg').textContent = msg;
        document.getElementById('successOverlay').classList.add('show');

        // redirect
        const redirect = new URLSearchParams(window.location.search).get(
          'redirect',
        );
        let dest = './index.html';
        if (redirect === 'reserve') dest = './reserve.html';
        else if (redirect === 'profile') dest = './profile.html';
        else if (redirect === 'admin') dest = './admin.html';
        else if (redirect === 'owner') dest = './owner.html';
        // اگر کاربر نقش admin داشت بره به پنل ادمین
        else if (data.user && data.user.role === 'admin') dest = './admin.html';
        setTimeout(() => {
          window.location.href = dest;
        }, 1500);
      }
    
