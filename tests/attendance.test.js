const request = require('supertest');
const app = require('../app');
const emailNotifier = require('../notifiers/emailNotifier');
const { Attendance, Notification, Student } = require('../models');
const { todayStr, addDays } = require('../utils/dates');
const h = require('./helpers');

let ctx;
beforeAll(h.connect);
afterAll(h.disconnect);
beforeEach(async () => { await h.clear(); ctx = await h.seedBasics(); });
afterEach(() => jest.restoreAllMocks());

const mark = (agent, classId, records, date = todayStr()) => agent.post('/api/attendance/mark').send({ classId: String(classId), date, records });
const rec = (student, status) => ({ studentId: String(student._id), status });

describe('authentication and roles', () => {
  test('login succeeds with correct credentials and never exposes the password hash', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'fa@t.edu', password: 'Passw0rd!' });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('fa@t.edu');
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/i);
    expect(res.headers['set-cookie'].join(';')).toMatch(/HttpOnly/i);
  });

  test('login fails with a wrong password or unknown email using the same message', async () => {
    const bad = await request(app).post('/api/auth/login').send({ email: 'fa@t.edu', password: 'nope' });
    const unknown = await request(app).post('/api/auth/login').send({ email: 'ghost@t.edu', password: 'nope' });
    expect(bad.status).toBe(401); expect(unknown.status).toBe(401);
    expect(bad.body.message).toBe(unknown.body.message);
  });

  test('protected routes need a session, and faculty cannot use admin routes', async () => {
    expect((await request(app).get('/api/classes')).status).toBe(401);
    const fac = await h.login(app, 'fa@t.edu');
    expect((await fac.post('/api/students').send({})).status).toBe(403);
    expect((await fac.get('/api/notifications')).status).toBe(403);
    expect((await fac.get('/api/faculty')).status).toBe(403);
  });
});

describe('student CRUD', () => {
  test('admin can create, update and delete a student; duplicate roll numbers are rejected', async () => {
    const admin = await h.login(app, 'admin@t.edu');
    const body = { studentId: 'S9', name: 'Test Student', rollNumber: '30', classId: String(ctx.a._id), parentName: 'Parent', parentEmail: 'p@example.com', parentPhone: '+91 98765 43210' };
    const created = await admin.post('/api/students').send(body);
    expect(created.status).toBe(201);

    const dup = await admin.post('/api/students').send({ ...body, studentId: 'S10' }); // same roll number in the same class
    expect(dup.status).toBe(409);
    expect(dup.body.message).toMatch(/roll number/i);

    const sameRollOtherClass = await admin.post('/api/students').send({ ...body, studentId: 'S11', classId: String(ctx.b._id) });
    expect(sameRollOtherClass.status).toBe(201);

    const upd = await admin.put(`/api/students/${created.body.student._id}`).send({ ...body, name: 'Renamed' });
    expect(upd.body.student.name).toBe('Renamed');

    expect((await admin.delete(`/api/students/${created.body.student._id}`)).status).toBe(200);
    expect(await Student.findById(created.body.student._id)).toBeNull();
  });

  test('invalid parent email is rejected', async () => {
    const admin = await h.login(app, 'admin@t.edu');
    const res = await admin.post('/api/students').send({ studentId: 'S9', name: 'X Y', rollNumber: '9', classId: String(ctx.a._id), parentName: 'P Q', parentEmail: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.errors.parentEmail).toBeDefined();
  });
});

describe('marking attendance', () => {
  test('marking twice for the same student, class and date never creates duplicates', async () => {
    const fac = await h.login(app, 'fa@t.edu');
    const records = ctx.students.map((s) => rec(s, 'PRESENT'));
    expect((await mark(fac, ctx.a._id, records)).status).toBe(200);
    expect((await mark(fac, ctx.a._id, records)).status).toBe(200);
    expect(await Attendance.countDocuments({})).toBe(3);
  });

  test('the database itself rejects a duplicate record (unique index)', async () => {
    const s = ctx.students[0];
    const doc = { studentId: s._id, classId: ctx.a._id, date: '2026-01-05', session: 'DAILY', status: 'PRESENT' };
    await Attendance.create(doc);
    await expect(Attendance.create(doc)).rejects.toMatchObject({ code: 11000 });
  });

  test('an absent mark creates exactly one notification, and re-submitting does not create another', async () => {
    const fac = await h.login(app, 'fa@t.edu');
    const records = [rec(ctx.students[0], 'ABSENT'), rec(ctx.students[1], 'PRESENT'), rec(ctx.students[2], 'PRESENT')];
    const send = jest.spyOn(emailNotifier, 'send');

    const first = await mark(fac, ctx.a._id, records);
    expect(first.body.notificationsQueued).toBe(1);
    await h.waitFor(async () => (await Notification.findOne({ status: 'SENT' })));
    const second = await mark(fac, ctx.a._id, records);
    expect(second.body.notificationsQueued).toBe(0);
    await h.drain();

    expect(await Notification.countDocuments({})).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
    const n = await Notification.findOne({});
    expect(n.parentContact).toBe('sunita@example.com');
    expect(n.message).toContain('Dear Sunita Kumar');
    expect(n.message).toContain('Rahul Kumar (Roll No. 23)');
    expect(n.message).toContain(new Date().getFullYear().toString());
    expect(send.mock.calls[0][0]).toMatchObject({ to: 'sunita@example.com', subject: 'Student Attendance Alert' });
    expect((await Attendance.findOne({ studentId: ctx.students[0]._id })).notificationStatus).toBe('SENT');
  });

  test('a present mark creates no notification', async () => {
    const fac = await h.login(app, 'fa@t.edu');
    const res = await mark(fac, ctx.a._id, ctx.students.map((s) => rec(s, 'PRESENT')));
    expect(res.body.notificationsQueued).toBe(0);
    await h.drain();
    expect(await Notification.countDocuments({})).toBe(0);
    expect((await Attendance.findOne({})).notificationStatus).toBe('NOT_REQUIRED');
  });

  test('Present then corrected to Absent notifies; Absent corrected to Present afterwards sends nothing more', async () => {
    const fac = await h.login(app, 'fa@t.edu');
    const base = ctx.students.map((s) => rec(s, 'PRESENT'));
    await mark(fac, ctx.a._id, base);
    const res = await mark(fac, ctx.a._id, [rec(ctx.students[2], 'ABSENT'), rec(ctx.students[0], 'PRESENT'), rec(ctx.students[1], 'PRESENT')]);
    expect(res.body.notificationsQueued).toBe(1);
    await h.waitFor(() => Notification.findOne({ status: 'SENT' }));
    await mark(fac, ctx.a._id, base);
    expect(await Notification.countDocuments({})).toBe(1);
  });

  test('a failed email is logged as FAILED, then the retry worker delivers it', async () => {
    const fac = await h.login(app, 'fa@t.edu');
    const send = jest.spyOn(emailNotifier, 'send').mockRejectedValueOnce(new Error('SMTP connection refused'));
    await mark(fac, ctx.a._id, [rec(ctx.students[0], 'ABSENT'), rec(ctx.students[1], 'PRESENT'), rec(ctx.students[2], 'PRESENT')]);

    const failed = await h.waitFor(() => Notification.findOne({ status: 'FAILED' }));
    expect(failed.attempts).toBe(1);
    expect(failed.lastError).toMatch(/SMTP connection refused/);
    expect(failed.nextRetryAt.getTime()).toBeGreaterThan(Date.now() - 1000);
    expect((await Attendance.findOne({ studentId: ctx.students[0]._id })).notificationStatus).toBe('FAILED');

    await Notification.updateOne({ _id: failed._id }, { $set: { nextRetryAt: new Date(Date.now() - 1000) } }); // backoff elapsed
    await h.drain();
    const done = await Notification.findById(failed._id);
    expect(done.status).toBe('SENT');
    expect(done.attempts).toBe(2);
    expect(send).toHaveBeenCalledTimes(2);
    expect((await Attendance.findOne({ studentId: ctx.students[0]._id })).notificationStatus).toBe('SENT');
  });

  test('two workers racing for the same alert send it only once', async () => {
    const fac = await h.login(app, 'fa@t.edu');
    const send = jest.spyOn(emailNotifier, 'send').mockImplementation(async () => { await h.sleep(80); return { mode: 'outbox' }; });
    await mark(fac, ctx.a._id, [rec(ctx.students[0], 'ABSENT'), rec(ctx.students[1], 'PRESENT'), rec(ctx.students[2], 'PRESENT')]);
    const { processDue } = require('../services/notificationService');
    await Promise.all([processDue(), processDue(), processDue()]);
    await h.waitFor(() => Notification.findOne({ status: 'SENT' }));
    await h.drain();
    expect(send).toHaveBeenCalledTimes(1);
  });

  test('an unsent alert is cancelled when the absence is corrected to Present', async () => {
    const fac = await h.login(app, 'fa@t.edu');
    jest.spyOn(emailNotifier, 'send').mockRejectedValue(new Error('down'));
    await mark(fac, ctx.a._id, [rec(ctx.students[0], 'ABSENT'), rec(ctx.students[1], 'PRESENT'), rec(ctx.students[2], 'PRESENT')]);
    await h.waitFor(() => Notification.findOne({ status: 'FAILED' }));
    await mark(fac, ctx.a._id, ctx.students.map((s) => rec(s, 'PRESENT')));
    expect((await Notification.findOne({})).status).toBe('CANCELLED');
  });

  test('faculty cannot mark a class that is not assigned to them, or a future date', async () => {
    const fb = await h.login(app, 'fb@t.edu');
    expect((await mark(fb, ctx.a._id, [rec(ctx.students[0], 'ABSENT')])).status).toBe(403);
    const fa = await h.login(app, 'fa@t.edu');
    const future = await mark(fa, ctx.a._id, [rec(ctx.students[0], 'ABSENT')], addDays(todayStr(), 3));
    expect(future.status).toBe(400);
    expect(await Notification.countDocuments({})).toBe(0);
  });

  test('students from another class are rejected', async () => {
    const admin = await h.login(app, 'admin@t.edu');
    const other = await Student.create({ studentId: 'B1', name: 'Other Kid', rollNumber: '1', classId: ctx.b._id, parentName: 'P', parentEmail: 'x@example.com' });
    const res = await mark(admin, ctx.a._id, [rec(other, 'ABSENT')]);
    expect(res.status).toBe(400);
  });
});

describe('reports', () => {
  test('attendance percentage is present days / marked days, with the below-75% flag', async () => {
    const [s1, s2] = ctx.students;
    const day = (n) => addDays(todayStr(), -n);
    const docs = [
      ...[1, 2, 3].map((n) => ({ studentId: s1._id, classId: ctx.a._id, date: day(n), status: 'PRESENT' })),
      { studentId: s1._id, classId: ctx.a._id, date: day(4), status: 'ABSENT' },               // 3/4 = 75%
      ...[1, 2].map((n) => ({ studentId: s2._id, classId: ctx.a._id, date: day(n), status: 'ABSENT' })),
      { studentId: s2._id, classId: ctx.a._id, date: day(3), status: 'PRESENT' },               // 1/3 = 33.3%
    ];
    await Attendance.insertMany(docs);
    const admin = await h.login(app, 'admin@t.edu');
    const res = await admin.get(`/api/reports/summary?classId=${ctx.a._id}`);
    const row = (id) => res.body.rows.find((r) => r.studentId === id);
    expect(row('S1')).toMatchObject({ present: 3, absent: 1, total: 4, percent: 75, belowThreshold: false });
    expect(row('S2')).toMatchObject({ present: 1, absent: 2, total: 3, percent: 33.3, belowThreshold: true });
    expect(row('S3')).toMatchObject({ total: 0, percent: null });

    const ranged = await admin.get(`/api/reports/summary?classId=${ctx.a._id}&from=${day(2)}&to=${day(1)}`);
    expect(ranged.body.rows.find((r) => r.studentId === 'S1')).toMatchObject({ total: 2, percent: 100 });
  });

  test('search by name, history and CSV export work; faculty only see their own classes', async () => {
    await Attendance.create({ studentId: ctx.students[0]._id, classId: ctx.a._id, date: addDays(todayStr(), -1), status: 'PRESENT' });
    const fa = await h.login(app, 'fa@t.edu');
    const search = await fa.get('/api/reports/summary?q=rahul');
    expect(search.body.rows).toHaveLength(1);
    const hist = await fa.get(`/api/reports/student/${ctx.students[0]._id}`);
    expect(hist.body.total).toBe(1);
    const csv = await fa.get('/api/reports/export.csv');
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.text).toContain('Rahul Kumar');

    const fb = await h.login(app, 'fb@t.edu');
    expect((await fb.get('/api/reports/summary')).body.rows).toHaveLength(0);
    expect((await fb.get(`/api/reports/student/${ctx.students[0]._id}`)).status).toBe(403);
  });
});
