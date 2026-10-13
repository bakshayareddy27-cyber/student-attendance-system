shellReady.then(async (user) => {
  const d = await api('/dashboard');
  const hr = new Date().getHours();
  const first = user.name.replace(/^(Dr|Prof)\.?\s+/i, '').split(' ')[0];
  document.getElementById('greeting').textContent = `${hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening'}, ${first}`;
  document.getElementById('todayLine').textContent = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const tile = (n, label, icon, bg, fg) => `<div class="col-6 col-xl-3"><div class="panel stat d-flex justify-content-between align-items-start gap-2">
      <div><div class="stat-n">${n}</div><div class="stat-l">${label}</div></div>
      <div class="stat-i" style="background:${bg};color:${fg}"><i class="bi ${icon}"></i></div></div></div>`;
  document.getElementById('stats').innerHTML =
    tile(d.counts.students, 'Students', 'bi-people', '#e4ebf7', '#27457d') +
    tile(d.today.absent, 'Absent today', 'bi-person-x', '#fde5e3', '#a8271f') +
    tile(`${d.today.classesMarked}/${d.counts.classes}`, 'Classes marked today', 'bi-check2-all', '#dff4e9', '#12663f') +
    tile(d.notifications.sent, `Alerts sent${d.notifications.failed ? ` · ${d.notifications.failed} failed` : ''}`, 'bi-envelope-check', '#fff1cc', '#8a5a00');

  // Trend chart (inline SVG)
  const t = d.trend;
  const box = document.getElementById('trend');
  if (!t.length) box.innerHTML = '<div class="empty"><i class="bi bi-bar-chart"></i><strong>No attendance yet</strong>Mark a class to see the trend here.</div>';
  else {
    const W = 560, H = 190, pad = { l: 34, r: 8, t: 10, b: 28 }; const bw = (W - pad.l - pad.r) / t.length;
    const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / 100);
    let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Attendance rate per day">`;
    [0, 50, 75, 100].forEach((g) => { s += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(g)}" y2="${y(g)}" stroke="${g === 75 ? '#e2a900' : '#e3e8e5'}" stroke-dasharray="${g === 75 ? '4 4' : '0'}"/><text x="${pad.l - 6}" y="${y(g) + 4}" text-anchor="end">${g}</text>`; });
    t.forEach((p, i) => {
      const x = pad.l + i * bw + bw * 0.18, w = bw * 0.64, top = y(p.rate);
      s += `<rect x="${x}" y="${top}" width="${w}" height="${y(0) - top}" rx="4" fill="${p.rate >= 75 ? '#1e9e63' : '#e2453c'}"><title>${fmtDate(p.date)}: ${p.rate}% present (${p.absent} absent)</title></rect>`;
      if (t.length <= 14 || i % 2 === 0) s += `<text x="${x + w / 2}" y="${H - 8}" text-anchor="middle">${p.date.slice(8)}</text>`;
    });
    box.innerHTML = s + '</svg>';
  }

  const recent = document.getElementById('recent');
  recent.innerHTML = d.recent.length ? d.recent.map((n) => `<div class="d-flex justify-content-between align-items-center py-2 border-bottom">
      <div><div class="fw-semibold">${esc(n.studentName)}</div><div class="muted small">${esc(n.parentContact)} · ${fmtDateTime(n.sentAt || n.createdAt)}</div></div>${statusChip(n.status)}</div>`).join('')
    : '<div class="empty py-4"><i class="bi bi-envelope"></i><strong>No alerts yet</strong>They appear when a student is marked absent.</div>';

  document.getElementById('classes').innerHTML = d.classes.length ? d.classes.map((c) => {
    const tot = c.present + c.absent;
    return `<div class="col-md-6 col-xl-4"><div class="panel class-card">
      <div class="d-flex justify-content-between align-items-start"><div><div class="cname">${esc(c.name)}</div><div class="muted small">${esc(c.department)} · ${c.studentCount} students</div></div>
        ${c.marked ? '<span class="chip chip-ok"><i class="bi bi-check2"></i>Marked</span>' : '<span class="chip chip-warn"><i class="bi bi-clock"></i>Not marked</span>'}</div>
      <div><div class="split"><span class="p" style="width:${tot ? (c.present / tot) * 100 : 0}%"></span><span class="a" style="width:${tot ? (c.absent / tot) * 100 : 0}%"></span></div>
        <div class="d-flex justify-content-between small muted mt-2"><span>${c.present} present</span><span>${c.absent} absent</span></div></div>
      <a class="btn ${c.marked ? 'btn-ghost' : 'btn-primary'} mt-auto" href="/attendance.html?classId=${c._id}">${c.marked ? 'Review or edit' : 'Mark today'}</a></div></div>`;
  }).join('') : '<div class="col-12"><div class="panel empty"><i class="bi bi-collection"></i><strong>No classes assigned</strong>Ask an administrator to assign a class to you.</div></div>';
}).catch((e) => toast(e.message, 'err'));
