const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { validate, z, objectId } = require('../middleware/validate');
const { asyncHandler, httpError } = require('../middleware/errorHandler');
const { requireAuth, requireRole } = require('../middleware/auth');

const base = {
  name: z.string().trim().min(2, 'Enter a name').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  assignedClasses: z.array(objectId).default([]),
};
const createBody = z.object({ ...base, password: z.string().min(8, 'Use at least 8 characters').max(100) });
const updateBody = z.object({ ...base, password: z.string().min(8, 'Use at least 8 characters').max(100).optional().or(z.literal('')) });
const idParam = z.object({ id: objectId });

router.use(requireAuth, requireRole('admin'));

router.get('/', asyncHandler(async (_req, res) => {
  const faculty = await User.find({ role: 'faculty' }).sort({ name: 1 }).populate('assignedClasses', 'name');
  res.json({ success: true, faculty });
}));

router.post('/', validate(createBody), asyncHandler(async (req, res) => {
  const { password, ...rest } = req.body;
  const user = await User.create({ ...rest, role: 'faculty', passwordHash: await bcrypt.hash(password, 10) });
  res.status(201).json({ success: true, faculty: user });
}));

router.put('/:id', validate(idParam, 'params'), validate(updateBody), asyncHandler(async (req, res) => {
  const { password, ...rest } = req.body;
  const update = { ...rest };
  if (password) update.passwordHash = await bcrypt.hash(password, 10);
  const user = await User.findOneAndUpdate({ _id: req.params.id, role: 'faculty' }, update, { returnDocument: 'after', runValidators: true });
  if (!user) throw httpError(404, 'Faculty member not found');
  res.json({ success: true, faculty: user });
}));

router.delete('/:id', validate(idParam, 'params'), asyncHandler(async (req, res) => {
  const user = await User.findOneAndDelete({ _id: req.params.id, role: 'faculty' });
  if (!user) throw httpError(404, 'Faculty member not found');
  res.json({ success: true });
}));

module.exports = router;
