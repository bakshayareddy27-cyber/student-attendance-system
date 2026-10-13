const router = require('express').Router();
const { Student } = require('../models');
const { validate, z, objectId, dateStr } = require('../middleware/validate');
const { asyncHandler, httpError } = require('../middleware/errorHandler');
const { requireAuth, scopeClassIds, assertClassAccess } = require('../middleware/auth');
const { isValidDateStr } = require('../utils/dates');
const reports = require('../services/reportService');

const validDate = dateStr.refine(isValidDateStr, 'Enter a real date');
const filters = z.object({
  classId: objectId.optional(), from: validDate.optional(), to: validDate.optional(),
  q: z.string().trim().max(60).optional(), threshold: z.coerce.number().min(0).max(100).default(75),
}).refine((f) => !f.from || !f.to || f.from <= f.to, { message: 'The start date must be before the end date', path: ['from'] });

router.use(requireAuth);

router.get('/summary', validate(filters, 'query'), asyncHandler(async (req, res) => {
  if (req.query.classId) assertClassAccess(req.user, req.query.classId);
  res.json({ success: true, ...(await reports.summary({ ...req.query, classIds: scopeClassIds(req.user) })) });
}));

router.get('/export.csv', validate(filters, 'query'), asyncHandler(async (req, res) => {
  if (req.query.classId) assertClassAccess(req.user, req.query.classId);
  const { rows } = await reports.summary({ ...req.query, classIds: scopeClassIds(req.user) });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="attendance-report.csv"');
  res.send(`\uFEFF${reports.toCsv(rows)}`);
}));

router.get('/student/:id', validate(z.object({ id: objectId }), 'params'),
  validate(z.object({ from: validDate.optional(), to: validDate.optional() }), 'query'),
  asyncHandler(async (req, res) => {
    const student = await Student.findById(req.params.id).lean();
    if (!student) throw httpError(404, 'Student not found');
    assertClassAccess(req.user, student.classId);
    const history = await reports.studentHistory({ student, ...req.query });
    res.json({ success: true, student, ...history });
  }));

module.exports = router;
