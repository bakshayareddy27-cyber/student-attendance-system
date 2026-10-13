const router = require('express').Router();
const { validate, z, objectId, dateStr } = require('../middleware/validate');
const { asyncHandler, httpError } = require('../middleware/errorHandler');
const { requireAuth, assertClassAccess } = require('../middleware/auth');
const { isValidDateStr } = require('../utils/dates');
const { markAttendance } = require('../services/attendanceService');
const { dailyReport } = require('../services/reportService');

const validDate = dateStr.refine(isValidDateStr, 'Enter a real date');

router.use(requireAuth);

router.post('/mark', validate(z.object({
  classId: objectId, date: validDate,
  records: z.array(z.object({ studentId: objectId, status: z.enum(['PRESENT', 'ABSENT']) })).min(1, 'No attendance records were provided').max(500),
})), asyncHandler(async (req, res) => {
  const result = await markAttendance({ user: req.user, ...req.body });
  res.json({ success: true, ...result });
}));

router.get('/daily', validate(z.object({ classId: objectId, date: validDate }), 'query'), asyncHandler(async (req, res) => {
  assertClassAccess(req.user, req.query.classId);
  res.json({ success: true, ...(await dailyReport(req.query)) });
}));

module.exports = router;
