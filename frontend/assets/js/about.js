// ── EmailJS config ──
// ۱. برو emailjs.com و حساب بساز
// ۲. یه Email Service اضافه کن (Gmail و...)
// ۳. یه Template بساز با متغیرهای: from_name, from_contact, subject, message
// ۴. مقادیر زیر رو با اطلاعات خودت جایگزین کن:
const EJS_PUBLIC_KEY = 'HyeGNT0Bb6JKOptnp'; // Account > API Keys
const EJS_SERVICE_ID = 'service_9f54yac'; // Email Services
const EJS_TEMPLATE_ID = 'template_pfxkoiw'; // Email Templates
emailjs.init({ publicKey: EJS_PUBLIC_KEY });

// ── Scroll reveal ──
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) e.target.classList.add('show');
    });
  },
  { threshold: 0.15 },
);
document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));

// ── Show "حساب من" if logged in ──
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

// ── Send contact form via EmailJS ──
async function sendContact() {
  const name = document.getElementById('cName').value.trim();
  const contact = document.getElementById('cContact').value.trim();
  const subject = document.getElementById('cSubject').value;
  const msg = document.getElementById('cMsg').value.trim();

  // Basic validation
  if (!name) {
    shake('cName');
    return;
  }
  if (!contact) {
    shake('cContact');
    return;
  }
  if (!subject) {
    shake('cSubject');
    return;
  }
  if (!msg) {
    shake('cMsg');
    return;
  }

  const btn = document.getElementById('cSubmitBtn');
  btn.classList.add('loading');
  btn.disabled = true;

  try {
    await emailjs.send(EJS_SERVICE_ID, EJS_TEMPLATE_ID, {
      from_name: name,
      from_contact: contact,
      subject: subject,
      message: msg,
    });

    // Success
    btn.style.display = 'none';
    document.getElementById('cSuccess').classList.add('show');

    // Clear form
    ['cName', 'cContact', 'cMsg'].forEach(
      (id) => (document.getElementById(id).value = ''),
    );
    document.getElementById('cSubject').value = '';
  } catch (err) {
    console.error('EmailJS error:', err);

    // Fallback: open mailto
    const mailBody = encodeURIComponent(
      `نام: ${name}
تماس: ${contact}
موضوع: ${subject}

${msg}`,
    );
    window.location.href = `mailto:info@sanschi.ir?subject=${encodeURIComponent(subject)}&body=${mailBody}`;

    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

// ── Shake animation for empty fields ──
function shake(id) {
  const el = document.getElementById(id);
  el.style.borderColor = '#ef4444';
  el.style.animation = 'shake .4s ease';
  setTimeout(() => {
    el.style.animation = '';
    el.style.borderColor = '';
  }, 500);
  el.focus();
}
