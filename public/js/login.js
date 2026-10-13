const form = document.getElementById('loginForm');
const errBox = document.getElementById('loginError');

// If there's already a valid session, skip the form.
api('/auth/me').then((r) => { if (r.user) location.href = '/dashboard.html'; }).catch(() => {});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errBox.classList.add('d-none');
  const email = form.email.value.trim(); const password = form.password.value;
  if (!email || !password) { errBox.textContent = 'Enter your email and password.'; errBox.classList.remove('d-none'); return; }
  const btn = document.getElementById('loginBtn');
  setBusy(btn, true, 'Signing in');
  try {
    await api('/auth/login', { method: 'POST', body: { email, password } });
    location.href = '/dashboard.html';
  } catch (err) {
    errBox.textContent = err.message; errBox.classList.remove('d-none'); setBusy(btn, false);
  }
});

document.getElementById('togglePw').addEventListener('click', (e) => {
  const pw = form.password; const show = pw.type === 'password';
  pw.type = show ? 'text' : 'password';
  e.currentTarget.innerHTML = `<i class="bi ${show ? 'bi-eye-slash' : 'bi-eye'}"></i>`;
});
document.querySelectorAll('[data-fill]').forEach((b) => b.addEventListener('click', () => {
  const [em, pw] = b.dataset.fill.split('|'); form.email.value = em; form.password.value = pw; form.password.focus();
}));

// One moment of motion: Rahul flips to Absent and the parent alert line appears.
setTimeout(() => {
  const chip = document.getElementById('flipChip');
  chip.className = 'chip chip-bad'; chip.innerHTML = '<i class="bi bi-x-lg"></i>Absent';
  document.getElementById('flipRow').classList.add('flip');
}, 1400);
