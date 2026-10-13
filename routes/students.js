const router = require('express').Router();
const { Student, Attendance, Notification, Class } = require('../models');
const { validate, z, objectId } = require('../middleware/validate');
const { asyncHandler, httpError } = require('../middleware/errorHandler');
const { requireAuth, requireRole, scopeClassIds, assertClassAccess } = require('../middleware/auth');

const phone = z.string().trim().regex(/^(\+?\d[\d\s-]{6,14})?$/, 'Enter a valid phone number').optional().default('');
const studentBody = z.object({
  studentId: z.string().trim().min(2, 'Enter a student ID').max(30),
  name: z.string().trim().min(2, 'Enter the student\'s name').max(80),
  rollNumber: z.string().trim().min(1, 'Enter a roll number').max(15),
  classId: objectId,
  parentName: z.string().trim().min(2, 'Enter the parent\'s name').max(80),
  parentEmail: z.string().trim().toLowerCase().email('Enter a valid parent email'),
  parentPhone: phone,
});
const idParam = z.object({ id: objectId });

/** Friendly duplicate checks. The unique indexes still guard against races. */
async function assertUnique(body, excludeId) {
  const not = excludeId ? { _id: { $ne: excludeId } } : {};
  if (await Student.exists({ classId: body.classId, rollNumber: body.rollNumber, ...not })) throw httpError(409, 'That roll number is already used in this class', { rollNumber: 'Already used in this class' });
  if (await Student.exists({ studentId: body.studentId, ...not })) throw httpError(409, 'That student ID already exists', { studentId: 'Already exists' });
}
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

router.use(requireAuth);

router.get('/', validate(z.object({
  classId: objectId.optional(), q: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(200).default(20),
}), 'query'), asyncHandler(async (req, res) => {
  const { classId, q, page, limit } = req.query;
  const query = {};
  const scope = scopeClassIds(req.user);
  if (classId) { assertClassAccess(req.user, classId); query.classId = classId; }
  else if (scope) query.classId = { $in: scope };
  if (q) { const rx = new RegExp(escapeRegex(q), 'i'); query.$or = [{ name: rx }, { rollNumber: rx }, { studentId: rx }, { parentName: rx }]; }

  // Roll numbers sort naturally (2 before 10), so sorting and paging happen here; fine at college-class scale.
  const [all, classes] = await Promise.all([Student.find(query).lean(), Class.find().select('name').lean()]);
  const names = new Map(classes.map((c) => [String(c._id), c.name]));
  all.sort((a, b) => (names.get(String(a.classId)) || '').localeCompare(names.get(String(b.classId)) || '')
    || String(a.rollNumber).localeCompare(String(b.rollNumber), undefined, { numeric: true }));
  const total = all.length;
  const students = all.slice((page - 1) * limit, page * limit);
  res.json({
    success: true, total, page, pages: Math.max(1, Math.ceil(total / limit)),
    students: students.map((s) => ({ ...s, className: names.get(String(s.classId)) || '-' })),
  });
}));

router.post('/', requireRole('admin'), validate(studentBody), asyncHandler(async (req, res) => {
  if (!(await Class.exists({ _id: req.body.classId }))) throw httpError(400, 'Choose a valid class');
  await assertUnique(req.body);
  res.status(201).json({ success: true, student: await Student.create(req.body) });
}));

router.put('/:id', requireRole('admin'), validate(idParam, 'params'), validate(studentBody), asyncHandler(async (req, res) => {
  await assertUnique(req.body, req.params.id);
  const student = await Student.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after', runValidators: true });
  if (!student) throw httpError(404, 'Student not found');
  res.json({ success: true, student });
}));

router.delete('/:id', requireRole('admin'), validate(idParam, 'params'), asyncHandler(async (req, res) => {
  const student = await Student.findByIdAndDelete(req.params.id);
  if (!student) throw httpError(404, 'Student not found');
  await Promise.all([Attendance.deleteMany({ studentId: student._id }), Notification.deleteMany({ studentId: student._id })]);
  res.json({ success: true });
}));

module.exports = router;
