const { Attendance, Student, Class } = require('../models');
const { httpError } = require('../middleware/errorHandler');
const { assertClassAccess } = require('../middleware/auth');
const { todayStr } = require('../utils/dates');
const notifications = require('./notificationService');

/**
 * Saves a whole class's attendance for one date.
 *  - Idempotent: bulkWrite upserts on (studentId, classId, date, session); re-submitting never duplicates rows.
 *  - Parents are notified only AFTER the records are stored, once per absence.
 */
async function markAttendance({ user, classId, date, records, session = 'DAILY' }) {
  const cls = await Class.findById(classId);
  if (!cls) throw httpError(404, 'Class not found');
  assertClassAccess(user, classId);
  if (date > todayStr()) throw httpError(400, 'You cannot mark attendance for a future date');

  const students = await Student.find({ classId });
  const byId = new Map(students.map((s) => [String(s._id), s]));

  // Last entry wins if a student appears twice in the payload.
  const latest = new Map();
  for (const r of records) {
    if (!byId.has(r.studentId)) throw httpError(400, 'One or more students do not belong to this class');
    latest.set(r.studentId, r.status);
  }
  if (!latest.size) throw httpError(400, 'No attendance records were provided');

  const ops = [...latest].map(([studentId, status]) => ({
    updateOne: {
      filter: { studentId, classId, date, session },
      update: { $set: { status, markedBy: user._id }, $setOnInsert: { notificationStatus: 'NOT_REQUIRED' } },
      upsert: true,
    },
  }));
  await Attendance.bulkWrite(ops, { ordered: false });

  // ---- Records are saved. Only now do we deal with notifications. ----
  const saved = await Attendance.find({ classId, date, session, studentId: { $in: [...latest.keys()] } });
  const absent = saved.filter((a) => a.status === 'ABSENT');
  const present = saved.filter((a) => a.status === 'PRESENT');

  await notifications.cancelUnsent(present.map((a) => a._id));
  await Attendance.updateMany({ _id: { $in: present.map((a) => a._id) }, notificationStatus: { $in: ['PENDING', 'FAILED'] } },
    { $set: { notificationStatus: 'NOT_REQUIRED' } });

  let queued = 0;
  for (const a of absent) {
    if (await notifications.queueAbsenceNotification(a, byId.get(String(a.studentId)))) {
      queued += 1;
      await Attendance.updateOne({ _id: a._id }, { $set: { notificationStatus: 'PENDING' } });
    }
  }
  if (queued) notifications.kick();

  return { saved: saved.length, present: present.length, absent: absent.length, notificationsQueued: queued, date, className: cls.name };
}

module.exports = { markAttendance };
