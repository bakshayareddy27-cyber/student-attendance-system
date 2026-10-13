const { Attendance, Student, Class, Notification } = require('../models');
const { addDays, todayStr } = require('../utils/dates');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const naturalRoll = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true });
const pct = (present, total) => (total ? Math.round((present / total) * 1000) / 10 : null);

function dateFilter(from, to) {
  if (!from && !to) return null;
  const f = {};
  if (from) f.$gte = from;
  if (to) f.$lte = to;
  return f;
}

/** Attendance percentage per student = present days / days attendance was taken for that student. */
async function summary({ classIds, classId, from, to, q, threshold = 75 }) {
  const studentQuery = {};
  let scope = classIds; // null = all
  if (classId) scope = scope && !scope.includes(String(classId)) ? [] : [String(classId)];
  if (scope) studentQuery.classId = { $in: scope };
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    studentQuery.$or = [{ name: rx }, { rollNumber: rx }, { studentId: rx }];
  }
  const [students, classes] = await Promise.all([Student.find(studentQuery).lean(), Class.find().lean()]);
  const className = new Map(classes.map((c) => [String(c._id), c.name]));
  if (!students.length) return { rows: [], totals: { students: 0, avgPercent: null, belowThreshold: 0 }, threshold };

  const attQuery = { studentId: { $in: students.map((s) => s._id) } };
  const df = dateFilter(from, to);
  if (df) attQuery.date = df;
  const records = await Attendance.find(attQuery).select('studentId status date').lean();

  const tally = new Map();
  for (const r of records) {
    const t = tally.get(String(r.studentId)) || { present: 0, absent: 0 };
    if (r.status === 'PRESENT') t.present += 1; else t.absent += 1;
    tally.set(String(r.studentId), t);
  }

  const rows = students.map((s) => {
    const t = tally.get(String(s._id)) || { present: 0, absent: 0 };
    const total = t.present + t.absent;
    const percent = pct(t.present, total);
    return {
      _id: s._id, studentId: s.studentId, name: s.name, rollNumber: s.rollNumber,
      classId: s.classId, className: className.get(String(s.classId)) || '-',
      present: t.present, absent: t.absent, total, percent,
      belowThreshold: percent !== null && percent < threshold,
    };
  }).sort((a, b) => a.className.localeCompare(b.className) || naturalRoll(a.rollNumber, b.rollNumber));

  const withData = rows.filter((r) => r.percent !== null);
  const totals = {
    students: rows.length,
    avgPercent: withData.length ? Math.round((withData.reduce((n, r) => n + r.percent, 0) / withData.length) * 10) / 10 : null,
    belowThreshold: rows.filter((r) => r.belowThreshold).length,
  };
  return { rows, totals, threshold };
}

async function studentHistory({ student, from, to }) {
  const query = { studentId: student._id };
  const df = dateFilter(from, to);
  if (df) query.date = df;
  const records = await Attendance.find(query).sort({ date: -1 }).select('date status notificationStatus').lean();
  const present = records.filter((r) => r.status === 'PRESENT').length;
  return {
    records, present, absent: records.length - present, total: records.length, percent: pct(present, records.length),
  };
}

/** Roll-call sheet for one class and date, including students who have not been marked yet. */
async function dailyReport({ classId, date }) {
  const [students, records] = await Promise.all([
    Student.find({ classId }).lean(),
    Attendance.find({ classId, date, session: 'DAILY' }).lean(),
  ]);
  const byStudent = new Map(records.map((r) => [String(r.studentId), r]));
  const notes = await Notification.find({ attendanceId: { $in: records.map((r) => r._id) } }).select('attendanceId status previewUrl lastError').lean();
  const noteByAtt = new Map(notes.map((n) => [String(n.attendanceId), n]));

  const rows = students.map((s) => {
    const r = byStudent.get(String(s._id));
    const n = r && noteByAtt.get(String(r._id));
    return {
      studentId: s._id, name: s.name, rollNumber: s.rollNumber, parentName: s.parentName, parentEmail: s.parentEmail,
      status: r ? r.status : 'UNMARKED',
      notificationStatus: r ? r.notificationStatus : null,
      notificationId: n ? n._id : null,
      previewUrl: n ? n.previewUrl : null,
    };
  }).sort((a, b) => naturalRoll(a.rollNumber, b.rollNumber));

  const present = rows.filter((r) => r.status === 'PRESENT').length;
  const absent = rows.filter((r) => r.status === 'ABSENT').length;
  return { date, marked: present + absent > 0, rows, counts: { total: rows.length, present, absent, unmarked: rows.length - present - absent } };
}

/** Day-by-day attendance rate for the dashboard chart. */
async function trend({ classIds, days = 14 }) {
  const end = todayStr();
  const start = addDays(end, -(days - 1));
  const query = { date: { $gte: start, $lte: end } };
  if (classIds) query.classId = { $in: classIds };
  const records = await Attendance.find(query).select('date status').lean();
  const byDate = new Map();
  for (const r of records) {
    const d = byDate.get(r.date) || { present: 0, absent: 0 };
    if (r.status === 'PRESENT') d.present += 1; else d.absent += 1;
    byDate.set(r.date, d);
  }
  return [...byDate].sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({ date, present: d.present, absent: d.absent, rate: pct(d.present, d.present + d.absent) }));
}

function toCsv(rows) {
  const cols = ['Class', 'Roll No', 'Student ID', 'Name', 'Present', 'Absent', 'Total days', 'Percentage'];
  const cell = (v) => {
    let s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@]/.test(s)) s = `'${s}`; // neutralise spreadsheet formula injection
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [cols.join(',')];
  for (const r of rows) lines.push([r.className, r.rollNumber, r.studentId, r.name, r.present, r.absent, r.total, r.percent === null ? '' : `${r.percent}%`].map(cell).join(','));
  return lines.join('\n');
}

module.exports = { summary, studentHistory, dailyReport, trend, toCsv, pct };
