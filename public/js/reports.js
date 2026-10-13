shellReady.then(async (user) => {
  const $ = (id) => document.getElementById(id);
  const { classes } = await api('/classes');
  const opts = classes.map((c) => `<option value="${c._id}">${esc(c.name)}</option>`).join('');
  $('fClass').innerHTML = `<option value="">All classes</option>${opts}`;
  $('dClass').innerHTML = opts; $('dDate').value = todayISO(); $('dDate').max = todayISO();

  const qs = () => { const p = new URLSearchParams(); if ($('fClass').value) p.set('classId', $('fClass').value); if ($('fFrom').value) p.set('from', $('fFrom').value); if ($('fTo').value) p.set('to', $('fTo').value); if ($('fQ').value.trim()) p.set('q', $('fQ').value.trim()); return p.toString(); };

  const bar = (p) => p === null ? '<span class="muted">No data</span>' : `<div class="pbar"><div class="track"><div class="fill" style="width:${p}%;background:${p >= 75 ? '#1e9e63' : '#e2453c'}"></div></div><div class="val">${p}%</div></div>`;

  async function loadSummary() {
    $('sumBody').innerHTML = '<tr><td colspan="7"><div class="skeleton" style="height:36px"></div></td></tr>';
    $('csvBtn').href = `/api/reports/export.csv?${qs()}`;
    const r = await api(`/reports/summary?${qs()}`);
    const stat = (n, l) => `<div class="col-6 col-md-3"><div class="panel stat"><div class="stat-n">${n}</div><div class="stat-l">${l}</div></div></div>`;
    $('sumStats').innerHTML = stat(r.totals.students, 'Students') + stat(r.totals.avgPercent === null ? '-' : `${r.totals.avgPercent}%`, 'Average attendance') + stat(r.totals.belowThreshold, `Below ${r.threshold}%`);
    $('sumBody').innerHTML = r.rows.length ? r.rows.map((s) => `<tr>
      <td class="num fw-semibold">${esc(s.rollNumber)}</td><td><div class="fw-semibold">${esc(s.name)}</div><div class="muted small">${esc(s.studentId)}</div></td><td>${esc(s.className)}</td>
      <td class="text-end num">${s.present}</td><td class="text-end num">${s.absent}</td><td>${bar(s.percent)}</td>
      <td class="text-end">${s.belowThreshold ? '<span class="chip chip-bad me-2"><i class="bi bi-exclamation-triangle"></i>Below 75%</span>' : ''}<button class="btn btn-ghost btn-sm" data-hist="${s._id}">History</button></td></tr>`).join('')
      : '<tr><td colspan="7"><div class="empty"><i class="bi bi-search"></i><strong>No students match</strong>Change the class, dates or search.</div></td></tr>';
  }

  async function loadDaily() {
    if (!$('dClass').value || !$('dDate').value) return;
    const d = await api(`/attendance/daily?classId=${$('dClass').value}&date=${$('dDate').value}`);
    $('dCounts').innerHTML = `<span class="chip chip-ok">${d.counts.present} present</span><span class="chip chip-bad">${d.counts.absent} absent</span><span class="chip chip-mute">${d.counts.unmarked} not marked</span>`;
    $('dBody').innerHTML = d.rows.length ? d.rows.map((r) => `<tr><td class="num fw-semibold">${esc(r.rollNumber)}</td><td class="fw-semibold">${esc(r.name)}</td><td>${statusChip(r.status)}</td>
      <td><div>${esc(r.parentName)}</div><div class="muted small">${esc(r.parentEmail)}</div></td>
      <td>${r.status === 'ABSENT' ? statusChip(r.notificationStatus) : '<span class="muted">-</span>'}</td></tr>`).join('')
      : '<tr><td colspan="5"><div class="empty"><i class="bi bi-calendar-x"></i><strong>No students in this class</strong></div></td></tr>';
  }

  async function showHistory(id) {
    const modal = bootstrap.Modal.getOrCreateInstance($('histModal')); $('histBody').innerHTML = '<div class="skeleton" style="height:120px"></div>'; modal.show();
    const p = new URLSearchParams(); if ($('fFrom').value) p.set('from', $('fFrom').value); if ($('fTo').value) p.set('to', $('fTo').value);
    const h = await api(`/reports/student/${id}?${p}`);
    $('histTitle').textContent = `${h.student.name} (Roll ${h.student.rollNumber})`;
    $('histBody').innerHTML = `<div class="d-flex gap-2 flex-wrap mb-3"><span class="chip chip-ok">${h.present} present</span><span class="chip chip-bad">${h.absent} absent</span><span class="chip chip-info">${h.percent === null ? 'No data' : h.percent + '% attendance'}</span></div>`
      + (h.records.length ? `<div class="hist">${h.records.map((r) => `<span class="d ${r.status === 'PRESENT' ? 'p' : 'a'}" title="${r.status === 'PRESENT' ? 'Present' : 'Absent'}">${fmtDate(r.date)} · ${r.status === 'PRESENT' ? 'P' : 'A'}</span>`).join('')}</div>`
        : '<div class="empty py-4"><i class="bi bi-calendar-x"></i><strong>No attendance recorded</strong>for this period.</div>');
  }

  const safe = (fn) => (...a) => fn(...a).catch((e) => toast(e.message, 'err'));
  $('applyBtn').addEventListener('click', safe(loadSummary));
  $('fQ').addEventListener('keydown', (e) => { if (e.key === 'Enter') safe(loadSummary)(); });
  $('fClass').addEventListener('change', safe(loadSummary));
  $('resetBtn').addEventListener('click', () => { $('fClass').value = ''; $('fFrom').value = ''; $('fTo').value = ''; $('fQ').value = ''; safe(loadSummary)(); });
  $('dBtn').addEventListener('click', safe(loadDaily));
  $('sumBody').addEventListener('click', (e) => { const b = e.target.closest('[data-hist]'); if (b) safe(showHistory)(b.dataset.hist); });
  document.querySelector('[data-bs-target="#tabDaily"]').addEventListener('shown.bs.tab', safe(loadDaily));
  await loadSummary();
}).catch((e) => toast(e.message, 'err'));
