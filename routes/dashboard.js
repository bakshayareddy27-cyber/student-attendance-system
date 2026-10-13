const router = require('express').Router();
const { Class, Student, User, Attendance, Notification } = require('../models');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAuth, scopeClassIds } = require('../middleware/auth');
const { todayStr } = require('../utils/dates');
const { trend } = require('../services/reportService');

router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const scope = scopeClassIds(req.user);
  const date = todayStr();
  const classes = await Class.find(scope ? { _id: { $in: scope } } : {}).sort({ name: 1 }).lean();
  const classIds = classes.map((c) => c._id);

  const students = await Student.find({ classId: { $in: classIds } }).select('_id classId').lean();
  const todays = await Attendance.find({ classId: { $in: classIds }, date, session: 'DAILY' }).select('classId status').lean();

  const perClass = classes.map((c) => {
    const mine = todays.filter((a) => String(a.classId) === String(c._id));
    return {
      _id: c._id, name: c.name, department: c.department,
      studentCount: students.filter((s) => String(s.classId) === String(c._id)).length,
      marked: mine.length > 0, present: mine.filter((a) => a.status === 'PRESENT').length, absent: mine.filter((a) => a.status === 'ABSENT').length,
    };
  });

  const studentIds = students.map((s) => s._id);
  const noteQuery = { studentId: { $in: studentIds } };
  const [sent, pending, failed, recent, facultyCount] = await Promise.all([
    Notification.countDocuments({ ...noteQuery, status: 'SENT' }),
    Notification.countDocuments({ ...noteQuery, status: { $in: ['PENDING', 'SENDING'] } }),
    Notification.countDocuments({ ...noteQuery, status: 'FAILED' }),
    Notification.find(noteQuery).select('studentId parentContact status sentAt createdAt').sort({ createdAt: -1 }).limit(5).lean(),
    req.user.role === 'admin' ? User.countDocuments({ role: 'faculty' }) : null,
  ]);
  const names = new Map((await Student.find({ _id: { $in: recent.map((n) => n.studentId) } }).select('name').lean()).map((s) => [String(s._id), s.name]));

  res.json({
    success: true, date,
    counts: { students: students.length, classes: classes.length, faculty: facultyCount },
    today: { classesMarked: perClass.filter((c) => c.marked).length, present: todays.filter((a) => a.status === 'PRESENT').length, absent: todays.filter((a) => a.status === 'ABSENT').length },
    notifications: { sent, pending, failed },
    classes: perClass,
    trend: await trend({ classIds: scope ? scope : null }),
    recent: recent.map((n) => ({ ...n, studentName: names.get(String(n.studentId)) || 'Deleted student' })),
  });
}));

module.exports = router;
