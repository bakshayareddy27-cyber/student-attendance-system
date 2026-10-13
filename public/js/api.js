/* Shared helpers: fetch wrapper (redirects to login on 401), escaping, toasts. */
window.esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

window.api = async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method, credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && !location.pathname.endsWith('login.html')) {
    location.href = '/login.html';
    return new Promise(() => {});
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || 'Something went wrong. Please try again.');
    err.status = res.status; err.errors = data.errors || {};
    throw err;
  }
  return data;
};

window.toast = function toast(message, type = 'ok') {
  let stack = document.querySelector('.toast-stack');
  if (!stack) { stack = document.createElement('div'); stack.className = 'toast-stack'; stack.setAttribute('role', 'status'); stack.setAttribute('aria-live', 'polite'); document.body.appendChild(stack); }
  const el = document.createElement('div');
  el.className = `toast-lite ${type === 'ok' ? 'ok' : 'err'}`;
  el.innerHTML = `<i class="bi ${type === 'ok' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'}"></i><div>${esc(message)}</div>`;
  stack.appendChild(el);
  setTimeout(() => el.remove(), type === 'ok' ? 4000 : 6500);
};

window.fmtDate = (s) => {
  if (!s) return '-';
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};
window.fmtDateTime = (iso) => iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';
window.todayISO = () => new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

window.setBusy = (btn, busy, label) => {
  if (!btn) return;
  if (busy) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>${esc(label || 'Working')}`; }
  else { btn.disabled = false; if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
};

/** Shows server-side field errors under inputs whose name matches. */
window.showFieldErrors = (form, errors = {}) => {
  form.querySelectorAll('.is-invalid').forEach((i) => i.classList.remove('is-invalid'));
  form.querySelectorAll('.invalid-feedback.dyn').forEach((i) => i.remove());
  Object.entries(errors).forEach(([name, msg]) => {
    const input = form.querySelector(`[name="${name}"]`);
    if (!input) return;
    input.classList.add('is-invalid');
    const fb = document.createElement('div'); fb.className = 'invalid-feedback dyn'; fb.textContent = msg;
    input.insertAdjacentElement('afterend', fb);
  });
};

window.statusChip = (s) => {
  const map = { SENT: ['chip-ok', 'bi-check2-circle', 'Sent'], PENDING: ['chip-warn', 'bi-hourglass-split', 'Sending'], SENDING: ['chip-warn', 'bi-hourglass-split', 'Sending'],
    FAILED: ['chip-bad', 'bi-x-circle', 'Failed'], CANCELLED: ['chip-mute', 'bi-slash-circle', 'Cancelled'], NOT_REQUIRED: ['chip-mute', 'bi-dash', 'No alert needed'],
    PRESENT: ['chip-ok', 'bi-check-lg', 'Present'], ABSENT: ['chip-bad', 'bi-x-lg', 'Absent'], UNMARKED: ['chip-mute', 'bi-dash', 'Not marked'] };
  const [cls, icon, label] = map[s] || ['chip-mute', 'bi-dash', s];
  return `<span class="chip ${cls}"><i class="bi ${icon}"></i>${label}</span>`;
};
