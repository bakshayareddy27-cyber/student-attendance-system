const router = require('express').Router();
const { Notification, Student } = require('../models');
const { validate, z, objectId } = require('../middleware/validate');
const { asyncHandler, httpError } = require('../middleware/errorHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const { retryNow } = require('../services/notificationService');

router.use(requireAuth, requireRole('admin'));

router.get('/', validate(z.object({
  status: z.enum(['PENDING', 'SENDING', 'SENT', 'FAILED', 'CANCELLED']).optional(),
  page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(15),
}), 'query'), asyncHandler(async (req, res) => {
  const { status, page, limit } = req.query;
  const query = status ? { status } : {};
  const [total, items, counts] = await Promise.all([
    Notification.countDocuments(query),
    Notification.find(query).select('-html').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Promise.all(['SENT', 'PENDING', 'SENDING', 'FAILED'].map((s) => Notification.countDocuments({ status: s }))),
  ]);
  const students = await Student.find({ _id: { $in: items.map((n) => n.studentId) } }).select('name rollNumber').lean();
  const byId = new Map(students.map((s) => [String(s._id), s]));
  res.json({
    success: true, total, page, pages: Math.max(1, Math.ceil(total / limit)),
    counts: { sent: counts[0], pending: counts[1] + counts[2], failed: counts[3] },
    notifications: items.map((n) => ({ ...n, student: byId.get(String(n.studentId)) || null })),
  });
}));

router.post('/:id/retry', validate(z.object({ id: objectId }), 'params'), asyncHandler(async (req, res) => {
  const n = await retryNow(req.params.id);
  if (!n) throw httpError(409, 'Only failed or pending alerts can be retried');
  res.json({ success: true, message: 'Retry started' });
}));

// Shows the stored email (used by the local outbox mode, where no real inbox exists).
router.get('/:id/preview', validate(z.object({ id: objectId }), 'params'), asyncHandler(async (req, res) => {
  const n = await Notification.findById(req.params.id).select('html subject parentContact');
  if (!n) throw httpError(404, 'Alert not found');
  res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:");
  res.type('html').send(n.html);
}));

module.exports = router;
