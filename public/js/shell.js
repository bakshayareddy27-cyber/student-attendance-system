/* Builds the sidebar + mobile top bar around <main id="page"> and resolves window.shellReady with the signed-in user. */
(function () {
  const TALLY = `<svg class="tally" viewBox="0 0 34 34" fill="none" stroke="#f2c230" stroke-width="3.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6v22M13 6v22M20 6v22M27 6v22"/><path d="M2.5 24.5L30.5 9.5" stroke="#ffffff"/></svg>`;
  const NAV = [
    { href: '/dashboard.html', icon: 'bi-grid-1x2', label: 'Dashboard', roles: ['admin', 'faculty'], key: 'dashboard' },
    { href: '/attendance.html', icon: 'bi-check2-square', label: 'Take attendance', roles: ['admin', 'faculty'], key: 'attendance' },
    { href: '/reports.html', icon: 'bi-bar-chart-line', label: 'Reports', roles: ['admin', 'faculty'], key: 'reports' },
    { group: 'Manage', roles: ['admin'] },
    { href: '/students.html', icon: 'bi-people', label: 'Students', roles: ['admin'], key: 'students' },
    { href: '/classes.html', icon: 'bi-collection', label: 'Classes', roles: ['admin'], key: 'classes' },
    { href: '/faculty.html', icon: 'bi-person-badge', label: 'Faculty', roles: ['admin'], key: 'faculty' },
    { href: '/notifications.html', icon: 'bi-envelope-paper', label: 'Parent alerts', roles: ['admin'], key: 'notifications' },
  ];

  function sidebarHtml(user, college, current) {
    const items = NAV.filter((n) => n.roles.includes(user.role)).map((n) => n.group
      ? `<li class="nav-group">${n.group}</li>`
      : `<li><a href="${n.href}" class="${n.key === current ? 'active' : ''}" ${n.key === current ? 'aria-current="page"' : ''}><i class="bi ${n.icon}"></i>${n.label}</a></li>`).join('');
    const initials = user.name.replace(/^(Dr|Prof)\.?\s+/i, '').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
    return `<aside class="sidebar">
      <a class="brand" href="/dashboard.html">${TALLY}<div><div class="brand-name">Rollcall</div><div class="brand-sub">${esc(college)}</div></div></a>
      <nav aria-label="Main"><ul class="nav-list">${items}</ul></nav>
      <div class="sidebar-foot">
        <div class="who"><div class="avatar">${esc(initials)}</div><div><div class="who-name">${esc(user.name)}</div><div class="who-role">${user.role === 'admin' ? 'Administrator' : 'Faculty'}</div></div></div>
        <button class="btn btn-signout" data-signout><i class="bi bi-box-arrow-right"></i>Sign out</button>
      </div></aside>`;
  }

  window.shellReady = (async () => {
    const { user, college } = await api('/auth/me');
    const allowed = (document.body.dataset.roles || 'admin,faculty').split(',');
    if (!allowed.includes(user.role)) { location.href = '/dashboard.html'; return new Promise(() => {}); }

    const page = document.getElementById('page');
    const current = document.body.dataset.page;
    const app = document.createElement('div');
    app.className = 'app';
    app.innerHTML = `${sidebarHtml(user, college, current)}
      <div class="content">
        <header class="topbar-m"><a class="brand p-0" href="/dashboard.html">${TALLY}<span class="brand-name">Rollcall</span></a>
          <button class="btn" data-bs-toggle="offcanvas" data-bs-target="#navDrawer" aria-label="Open menu"><i class="bi bi-list fs-5"></i></button></header>
      </div>`;
    app.querySelector('.content').appendChild(page);
    document.getElementById('shell').replaceWith(app);

    const drawer = document.createElement('div');
    drawer.className = 'offcanvas offcanvas-start offcanvas-board'; drawer.id = 'navDrawer'; drawer.tabIndex = -1;
    drawer.innerHTML = sidebarHtml(user, college, current);
    document.body.appendChild(drawer);
    document.querySelectorAll("[data-signout]").forEach((b) => b.addEventListener('click', async () => { await api('/auth/logout', { method: 'POST' }); location.href = '/login.html'; }));
    page.hidden = false;
    document.title = `${document.title.split(' | ')[0]} | Rollcall`;
    return user;
  })();
})();
