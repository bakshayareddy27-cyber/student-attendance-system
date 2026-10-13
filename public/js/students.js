shellReady.then(async () => {
  const $ = (id) => document.getElementById(id);
  const form = $('form'); const formModal = new bootstrap.Modal($('formModal')); const delModal = new bootstrap.Modal($('delModal'));
  let page = 1, editing = null, deleting = null, classes = [], timer;

  classes = (await api('/classes')).classes;
  $('classFilter').innerHTML = `<option value="">All classes</option>${classes.map((c) => `<option value="${c._id}">${esc(c.name)}</option>`).join('')}`;
  $('f-classId').innerHTML = classes.map((c) => `<option value="${c._id}">${esc(c.name)}</option>`).join('');

  async function load() {
    const p = new URLSearchParams({ page, limit: 12 }); if ($('q').value.trim()) p.set('q', $('q').value.trim()); if ($('classFilter').value) p.set('classId', $('classFilter').value);
    const r = await api(`/students?${p}`);
    $('body').innerHTML = r.students.length ? r.students.map((s) => `<tr>
      <td class="num fw-semibold">${esc(s.rollNumber)}</td><td><div class="fw-semibold">${esc(s.name)}</div><div class="muted small">${esc(s.studentId)}</div></td><td>${esc(s.className)}</td>
      <td><div>${esc(s.parentName)}</div><div class="muted small">${esc(s.parentEmail)}${s.parentPhone ? ' · ' + esc(s.parentPhone) : ''}</div></td>
      <td class="text-end text-nowrap"><button class="btn btn-ghost btn-sm" data-edit="${s._id}" aria-label="Edit ${esc(s.name)}"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-ghost btn-sm text-danger" data-del="${s._id}" aria-label="Delete ${esc(s.name)}"><i class="bi bi-trash"></i></button></td></tr>`).join('')
      : `<tr><td colspan="5"><div class="empty"><i class="bi bi-people"></i><strong>No students found</strong>${$('q').value || $('classFilter').value ? 'Try clearing the search or class filter.' : 'Add your first student to get started.'}</div></td></tr>`;
    $('pager').innerHTML = `<span class="muted small">${r.total} student${r.total === 1 ? '' : 's'}</span>
      <div class="btn-group"><button class="btn btn-ghost btn-sm" id="prev" ${r.page <= 1 ? 'disabled' : ''}><i class="bi bi-chevron-left"></i></button><span class="btn btn-ghost btn-sm disabled">Page ${r.page} of ${r.pages}</span><button class="btn btn-ghost btn-sm" id="next" ${r.page >= r.pages ? 'disabled' : ''}><i class="bi bi-chevron-right"></i></button></div>`;
    $('prev').onclick = () => { page -= 1; load(); }; $('next').onclick = () => { page += 1; load(); };
    load.rows = r.students;
  }
  const safeLoad = () => load().catch((e) => toast(e.message, 'err'));

  $('q').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { page = 1; safeLoad(); }, 250); });
  $('classFilter').addEventListener('change', () => { page = 1; safeLoad(); });

  function openForm(s) {
    editing = s; form.reset(); showFieldErrors(form, {});
    $('formTitle').textContent = s ? 'Edit student' : 'Add student';
    if (s) { ['name', 'studentId', 'rollNumber', 'parentName', 'parentEmail', 'parentPhone'].forEach((k) => { form[k].value = s[k] || ''; }); form.classId.value = s.classId; }
    else if ($('classFilter').value) form.classId.value = $('classFilter').value;
    formModal.show();
  }
  $('addBtn').addEventListener('click', () => { if (!classes.length) return toast('Create a class first on the Classes page.', 'err'); openForm(null); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault(); const btn = $('saveBtn'); setBusy(btn, true, 'Saving');
    const body = Object.fromEntries(new FormData(form));
    try {
      await api(editing ? `/students/${editing._id}` : '/students', { method: editing ? 'PUT' : 'POST', body });
      formModal.hide(); toast(editing ? 'Student updated.' : 'Student added.'); await load();
    } catch (err) { showFieldErrors(form, err.errors); toast(err.message, 'err'); } finally { setBusy(btn, false); }
  });

  $('body').addEventListener('click', (e) => {
    const ed = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]');
    if (ed) openForm(load.rows.find((s) => s._id === ed.dataset.edit));
    if (del) { deleting = load.rows.find((s) => s._id === del.dataset.del); $('delText').innerHTML = `<strong>${esc(deleting.name)}</strong> (Roll ${esc(deleting.rollNumber)}) and all of their attendance records and parent alerts will be removed. This cannot be undone.`; delModal.show(); }
  });
  $('delBtn').addEventListener('click', async (e) => {
    setBusy(e.currentTarget, true, 'Deleting');
    try { await api(`/students/${deleting._id}`, { method: 'DELETE' }); delModal.hide(); toast('Student deleted.'); if (load.rows.length === 1 && page > 1) page -= 1; await load(); }
    catch (err) { toast(err.message, 'err'); } finally { setBusy(e.currentTarget, false); }
  });
  await safeLoad();
}).catch((e) => toast(e.message, 'err'));
