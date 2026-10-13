shellReady.then(async () => {
  const $ = (id) => document.getElementById(id);
  const form = $('form'); const formModal = new bootstrap.Modal($('formModal')); const delModal = new bootstrap.Modal($('delModal'));
  let editing = null, deleting = null, rows = [], classes = [];
  classes = (await api('/classes')).classes;
  $('classBoxes').innerHTML = classes.length ? classes.map((c) => `<div class="form-check"><input class="form-check-input" type="checkbox" id="cb-${c._id}" value="${c._id}"><label class="form-check-label" for="cb-${c._id}">${esc(c.name)}</label></div>`).join('') : '<div class="muted small">Create a class first.</div>';

  async function load() {
    rows = (await api('/faculty')).faculty;
    $('body').innerHTML = rows.length ? rows.map((f) => `<tr><td class="fw-semibold">${esc(f.name)}</td><td>${esc(f.email)}</td>
      <td>${f.assignedClasses.length ? f.assignedClasses.map((c) => `<span class="chip chip-info me-1">${esc(c.name)}</span>`).join('') : '<span class="muted">None assigned</span>'}</td>
      <td class="text-end text-nowrap"><button class="btn btn-ghost btn-sm" data-edit="${f._id}" aria-label="Edit ${esc(f.name)}"><i class="bi bi-pencil"></i></button>
      <button class="btn btn-ghost btn-sm text-danger" data-del="${f._id}" aria-label="Delete ${esc(f.name)}"><i class="bi bi-trash"></i></button></td></tr>`).join('')
      : '<tr><td colspan="4"><div class="empty"><i class="bi bi-person-badge"></i><strong>No faculty accounts</strong>Add a faculty member so they can take attendance.</div></td></tr>';
  }
  const safeLoad = () => load().catch((e) => toast(e.message, 'err'));

  function openForm(f) {
    editing = f; form.reset(); showFieldErrors(form, {}); $('formTitle').textContent = f ? 'Edit faculty' : 'Add faculty';
    $('pwHelp').textContent = f ? 'Leave blank to keep the current password.' : 'At least 8 characters.';
    $('classBoxes').querySelectorAll('input').forEach((i) => { i.checked = !!f && f.assignedClasses.some((c) => c._id === i.value); });
    if (f) { form.name.value = f.name; form.email.value = f.email; }
    formModal.show();
  }
  $('addBtn').addEventListener('click', () => openForm(null));
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); const btn = $('saveBtn'); setBusy(btn, true, 'Saving');
    const body = { name: form.name.value, email: form.email.value, password: form.password.value, assignedClasses: [...$('classBoxes').querySelectorAll('input:checked')].map((i) => i.value) };
    if (editing && !body.password) delete body.password;
    try { await api(editing ? `/faculty/${editing._id}` : '/faculty', { method: editing ? 'PUT' : 'POST', body }); formModal.hide(); toast(editing ? 'Faculty updated.' : 'Faculty added.'); await load(); }
    catch (err) { showFieldErrors(form, err.errors); toast(err.message, 'err'); } finally { setBusy(btn, false); }
  });
  $('body').addEventListener('click', (e) => {
    const ed = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]');
    if (ed) openForm(rows.find((f) => f._id === ed.dataset.edit));
    if (del) { deleting = rows.find((f) => f._id === del.dataset.del); $('delText').innerHTML = `<strong>${esc(deleting.name)}</strong> will no longer be able to sign in. Attendance they already marked is kept.`; delModal.show(); }
  });
  $('delBtn').addEventListener('click', async (e) => {
    setBusy(e.currentTarget, true, 'Deleting');
    try { await api(`/faculty/${deleting._id}`, { method: 'DELETE' }); delModal.hide(); toast('Faculty account deleted.'); await load(); } catch (err) { toast(err.message, 'err'); } finally { setBusy(e.currentTarget, false); }
  });
  await safeLoad();
}).catch((e) => toast(e.message, 'err'));
