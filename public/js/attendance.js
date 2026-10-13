shellReady.then(async (user) => {
  const classSel = document.getElementById('classSel'), dateSel = document.getElementById('dateSel'), findBox = document.getElementById('findBox');
  const panel = document.getElementById('rollPanel'), bar = document.getElementById('saveBar'), notice = document.getElementById('notice');
  const params = new URLSearchParams(location.search);
  let rows = [], status = new Map(), saved = false, pollTimer = null;

  dateSel.max = todayISO(); dateSel.value = params.get('date') || todayISO();
  const { classes } = await api('/classes');
  if (!classes.length) { panel.innerHTML = '<div class="empty"><i class="bi bi-collection"></i><strong>No classes available</strong>Ask an administrator to assign a class to you.</div>'; return; }
  classSel.innerHTML = classes.map((c) => `<option value="${c._id}">${esc(c.name)} (${c.studentCount} students)</option>`).join('');
  if (params.get('classId') && classes.some((c) => c._id === params.get('classId'))) classSel.value = params.get('classId');

  const counts = () => { let a = 0; status.forEach((v) => { if (v === 'ABSENT') a += 1; }); return { a, p: status.size - a }; };

  function paint() {
    const q = findBox.value.trim().toLowerCase();
    const list = rows.filter((r) => !q || r.name.toLowerCase().includes(q) || String(r.rollNumber).toLowerCase().includes(q));
    if (!rows.length) { panel.innerHTML = '<div class="empty"><i class="bi bi-people"></i><strong>No students in this class</strong>Add students from the Students page.</div>'; bar.classList.add('d-none'); return; }
    panel.innerHTML = list.length ? `<ul class="roll">${list.map((r) => {
      const st = status.get(r.studentId);
      const alert = saved && r.status === 'ABSENT' && st === 'ABSENT' && r.notificationStatus && r.notificationStatus !== 'NOT_REQUIRED'
        ? ` · ${statusChip(r.notificationStatus)}` : '';
      return `<li class="roll-row ${st === 'ABSENT' ? 'is-absent' : 'is-present'}" data-id="${r.studentId}">
        <div class="roll-no">${esc(r.rollNumber)}</div>
        <div><div class="roll-name">${esc(r.name)}</div><div class="roll-sub">Parent: ${esc(r.parentName)}${alert}</div></div>
        <div class="pa" role="group" aria-label="Attendance for ${esc(r.name)}">
          <button type="button" class="p" data-s="PRESENT" aria-pressed="${st === 'PRESENT'}"><i class="bi bi-check-lg me-1"></i>Present</button>
          <button type="button" class="a" data-s="ABSENT" aria-pressed="${st === 'ABSENT'}"><i class="bi bi-x-lg me-1"></i>Absent</button>
        </div></li>`;
    }).join('')}</ul>` : '<div class="empty"><i class="bi bi-search"></i><strong>No match</strong>Try a different name or roll number.</div>';
    const { a, p } = counts(); const tot = a + p || 1;
    document.getElementById('cPresent').textContent = p; document.getElementById('cAbsent').textContent = a;
    document.getElementById('barP').style.width = `${(p / tot) * 100}%`; document.getElementById('barA').style.width = `${(a / tot) * 100}%`;
    bar.classList.remove('d-none');
  }

  async function load({ keepStatus = false } = {}) {
    panel.innerHTML = '<div class="p-4"><div class="skeleton mb-3" style="height:48px"></div><div class="skeleton mb-3" style="height:48px"></div><div class="skeleton" style="height:48px"></div></div>';
    const d = await api(`/attendance/daily?classId=${classSel.value}&date=${dateSel.value}`);
    rows = d.rows; saved = d.marked;
    if (!keepStatus) status = new Map(rows.map((r) => [r.studentId, r.status === 'ABSENT' ? 'ABSENT' : 'PRESENT']));
    notice.innerHTML = d.marked
      ? `<div class="alert alert-info py-2"><i class="bi bi-info-circle me-2"></i>Attendance for this date is already saved. You can change it and save again; parents are alerted only once per absence.</div>`
      : d.rows.length ? `<div class="alert alert-light border py-2"><i class="bi bi-pencil me-2"></i>Not saved yet for this date. Everyone is shown as present until you change it.</div>` : '';
    paint();
    return d;
  }

  const syncUrl = () => { const u = new URL(location.href); u.searchParams.set('classId', classSel.value); u.searchParams.set('date', dateSel.value); window.history.replaceState(null, '', u); };
  const reload = () => { syncUrl(); load().catch((e) => toast(e.message, 'err')); };
  classSel.addEventListener('change', reload); dateSel.addEventListener('change', () => { if (dateSel.value) reload(); });
  findBox.addEventListener('input', paint);

  panel.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-s]'); if (!b) return;
    status.set(b.closest('.roll-row').dataset.id, b.dataset.s); paint();
    const again = panel.querySelector(`.roll-row[data-id="${b.closest('.roll-row').dataset.id}"] button[data-s="${b.dataset.s}"]`); if (again) again.focus();
  });
  document.getElementById('allPresent').addEventListener('click', () => { rows.forEach((r) => status.set(r.studentId, 'PRESENT')); paint(); });

  document.getElementById('saveBtn').addEventListener('click', async (e) => {
    const btn = e.currentTarget; setBusy(btn, true, 'Saving');
    try {
      const res = await api('/attendance/mark', { method: 'POST', body: { classId: classSel.value, date: dateSel.value, records: [...status].map(([studentId, s]) => ({ studentId, status: s })) } });
      toast(res.notificationsQueued ? `Attendance saved. ${res.notificationsQueued} parent alert${res.notificationsQueued > 1 ? 's' : ''} on the way.` : `Attendance saved for ${res.className}. ${res.absent ? 'Parents were already alerted.' : 'No absences to report.'}`);
      await load({ keepStatus: true });
      pollAlerts(0);
    } catch (err) { toast(err.message, 'err'); } finally { setBusy(btn, false); }
  });

  // After saving, check a few times so "Sending" turns into "Sent" without a refresh.
  function pollAlerts(n) {
    clearTimeout(pollTimer);
    if (n > 6 || !rows.some((r) => r.status === 'ABSENT' && ['PENDING'].includes(r.notificationStatus))) return;
    pollTimer = setTimeout(async () => { try { await load({ keepStatus: true }); } catch {} pollAlerts(n + 1); }, 1500);
  }

  await load();
  pollAlerts(0);
}).catch((e) => toast(e.message, 'err'));
