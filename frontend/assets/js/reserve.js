      // Update navbar login button if already logged in
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
    
