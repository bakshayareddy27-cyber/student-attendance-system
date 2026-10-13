const router = require('express').Router();
const { Class, Student, User, Attendance } = require('../models');
const { validate, z, objectId } = require('../middleware/validate');
const { asyncHandler, httpError } = require('../middleware/errorHandler');
const { requireAuth, requireRole, scopeClassIds } = require('../middleware/auth');

const classBody = z.object({
  name: z.string().trim().min(2, 'Enter a class name').max(40),
  department: z.string().trim().min(2, 'Enter a department').max(60),
  year: z.coerce.number().int().min(1).max(6),
  section: z.string().trim().max(10).optional().default(''),
});

router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  const scope = scopeClassIds(req.user);
  const classes = await Class.find(scope ? { _id: { $in: scope } } : {}).sort({ name: 1 }).lean();
  const counts = await Promise.all(classes.map((c) => Student.countDocuments({ classId: c._id })));
  res.json({ success: true, classes: classes.map((c, i) => ({ ...c, studentCount: counts[i] })) });
}));

router.post('/', requireRole('admin'), validate(classBody), asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, class: await Class.create(req.body) });
}));

router.put('/:id', requireRole('admin'), validate(z.object({ id: objectId }), 'params'), validate(classBody), asyncHandler(async (req, res) => {
  const cls = await Class.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after', runValidators: true });
  if (!cls) throw httpError(404, 'Class not found');
  res.json({ success: true, class: cls });
}));

router.delete('/:id', requireRole('admin'), validate(z.object({ id: objectId }), 'params'), asyncHandler(async (req, res) => {
  if (await Student.exists({ classId: req.params.id })) throw httpError(409, 'Move or delete this class\'s students first');
  const cls = await Class.findByIdAndDelete(req.params.id);
  if (!cls) throw httpError(404, 'Class not found');
  await User.updateMany({}, { $pull: { assignedClasses: cls._id } });
  await Attendance.deleteMany({ classId: cls._id });
  res.json({ success: true });
}));

module.exports = router;
