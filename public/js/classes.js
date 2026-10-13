shellReady.then(async () => {
  const $ = (id) => document.getElementById(id);
  const form = $('form'); const formModal = new bootstrap.Modal($('formModal')); const delModal = new bootstrap.Modal($('delModal'));
  let editing = null, deleting = null, rows = [];

  async function load() {
    rows = (await api('/classes')).classes;
    $('body').innerHTML = rows.length ? rows.map((c) => `<tr><td class="fw-semibold">${esc(c.name)}</td><td>${esc(c.department)}</td><td>${c.year}</td><td>${esc(c.section || '-')}</td><td class="text-end num">${c.studentCount}</td>
      <td class="text-end text-nowrap"><button class="btn btn-ghost btn-sm" data-edit="${c._id}" aria-label="Edit ${esc(c.name)}"><i class="bi bi-pencil"></i></button>
      <button class="btn btn-ghost btn-sm text-danger" data-del="${c._id}" aria-label="Delete ${esc(c.name)}"><i class="bi bi-trash"></i></button></td></tr>`).join('')
      : '<tr><td colspan="6"><div class="empty"><i class="bi bi-collection"></i><strong>No classes yet</strong>Add a class, then add its students.</div></td></tr>';
  }
  const safeLoad = () => load().catch((e) => toast(e.message, 'err'));

  function openForm(c) {
    editing = c; form.reset(); showFieldErrors(form, {}); $('formTitle').textContent = c ? 'Edit class' : 'Add class';
    if (c) { form.name.value = c.name; form.department.value = c.department; form.year.value = c.year; form.section.value = c.section || ''; }
    formModal.show();
  }
  $('addBtn').addEventListener('click', () => openForm(null));
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); const btn = $('saveBtn'); setBusy(btn, true, 'Saving');
    try { await api(editing ? `/classes/${editing._id}` : '/classes', { method: editing ? 'PUT' : 'POST', body: Object.fromEntries(new FormData(form)) }); formModal.hide(); toast(editing ? 'Class updated.' : 'Class added.'); await load(); }
    catch (err) { showFieldErrors(form, err.errors); toast(err.message, 'err'); } finally { setBusy(btn, false); }
  });
  $('body').addEventListener('click', (e) => {
    const ed = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]');
    if (ed) openForm(rows.find((c) => c._id === ed.dataset.edit));
    if (del) { deleting = rows.find((c) => c._id === del.dataset.del); $('delText').innerHTML = deleting.studentCount ? `<strong>${esc(deleting.name)}</strong> still has ${deleting.studentCount} students. Move or delete them first.` : `Delete <strong>${esc(deleting.name)}</strong>? Its attendance records will be removed.`; delModal.show(); }
  });
  $('delBtn').addEventListener('click', async (e) => {
    setBusy(e.currentTarget, true, 'Deleting');
    try { await api(`/classes/${deleting._id}`, { method: 'DELETE' }); delModal.hide(); toast('Class deleted.'); await load(); } catch (err) { delModal.hide(); toast(err.message, 'err'); } finally { setBusy(e.currentTarget, false); }
  });
  await safeLoad();
}).catch((e) => toast(e.message, 'err'));
