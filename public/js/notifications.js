shellReady.then(async () => {
  const $ = (id) => document.getElementById(id);
  const mailModal = new bootstrap.Modal($('mailModal'));
  let page = 1, rows = [], poll;

  async function load() {
    const p = new URLSearchParams({ page, limit: 12 }); if ($('statusFilter').value) p.set('status', $('statusFilter').value);
    const r = await api(`/notifications?${p}`); rows = r.notifications;
    const stat = (n, l, bg, fg) => `<div class="col-4"><div class="panel stat"><div class="stat-n" style="color:${fg}">${n}</div><div class="stat-l">${l}</div></div></div>`;
    $('stats').innerHTML = stat(r.counts.sent, 'Sent', '', '#12663f') + stat(r.counts.pending, 'Sending or waiting', '', '#8a5a00') + stat(r.counts.failed, 'Failed', '', '#a8271f');
    $('body').innerHTML = rows.length ? rows.map((n) => `<tr>
      <td><div class="fw-semibold">${esc(n.student ? n.student.name : 'Deleted student')}</div><div class="muted small">${n.student ? 'Roll ' + esc(n.student.rollNumber) : ''}</div></td>
      <td>${esc(n.parentContact)}</td>
      <td>${statusChip(n.status)}${n.lastError && n.status === 'FAILED' ? `<div class="small text-danger mt-1" style="max-width:260px">${esc(n.lastError)}</div>` : ''}</td>
      <td class="text-end num">${n.attempts}</td><td class="text-nowrap">${fmtDateTime(n.sentAt || n.createdAt)}</td>
      <td class="text-end text-nowrap">${n.status === 'SENT' ? `<button class="btn btn-ghost btn-sm" data-view="${n._id}" data-url="${esc(n.previewUrl || '')}"><i class="bi bi-eye me-1"></i>View email</button>` : ''}
        ${['FAILED', 'PENDING'].includes(n.status) ? `<button class="btn btn-ghost btn-sm" data-retry="${n._id}"><i class="bi bi-arrow-repeat me-1"></i>Retry now</button>` : ''}</td></tr>`).join('')
      : '<tr><td colspan="6"><div class="empty"><i class="bi bi-envelope"></i><strong>No alerts here</strong>Alerts appear when a student is marked absent.</div></td></tr>';
    $('pager').innerHTML = `<span class="muted small">${r.total} alert${r.total === 1 ? '' : 's'}</span><div class="btn-group"><button class="btn btn-ghost btn-sm" id="prev" ${r.page <= 1 ? 'disabled' : ''}><i class="bi bi-chevron-left"></i></button><span class="btn btn-ghost btn-sm disabled">Page ${r.page} of ${r.pages}</span><button class="btn btn-ghost btn-sm" id="next" ${r.page >= r.pages ? 'disabled' : ''}><i class="bi bi-chevron-right"></i></button></div>`;
    $('prev').onclick = () => { page -= 1; load(); }; $('next').onclick = () => { page += 1; load(); };
    clearTimeout(poll); if (r.counts.pending) poll = setTimeout(() => load().catch(() => {}), 3000);
  }
  const safeLoad = () => load().catch((e) => toast(e.message, 'err'));
  $('statusFilter').addEventListener('change', () => { page = 1; safeLoad(); });

  $('body').addEventListener('click', async (e) => {
    const v = e.target.closest('[data-view]'), r = e.target.closest('[data-retry]');
    if (v) {
      const url = v.dataset.url || `/api/notifications/${v.dataset.view}/preview`;
      if (url.startsWith('http')) { window.open(url, '_blank', 'noopener'); return; }
      $('mailFrame').src = url; mailModal.show();
    }
    if (r) { setBusy(r, true, 'Retrying'); try { await api(`/notifications/${r.dataset.retry}/retry`, { method: 'POST' }); toast('Retry started.'); setTimeout(safeLoad, 1200); } catch (err) { toast(err.message, 'err'); setBusy(r, false); } }
  });
  await safeLoad();
}).catch((e) => toast(e.message, 'err'));
