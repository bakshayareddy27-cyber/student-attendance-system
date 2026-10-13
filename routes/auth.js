const router = require('express').Router();
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const env = require('../config/env');
const { User } = require('../models');
const { validate, z } = require('../middleware/validate');
const { asyncHandler, httpError } = require('../middleware/errorHandler');
const { setAuthCookie, requireAuth } = require('../middleware/auth');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  handler: (_req, _res, next) => next(httpError(429, 'Too many sign-in attempts. Try again in a few minutes')),
});

// Compared against when the email is unknown so response time does not reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

router.post('/login', loginLimiter,
  validate(z.object({ email: z.string().trim().toLowerCase().email('Enter a valid email'), password: z.string().min(1, 'Enter your password') })),
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.body.email }).select('+passwordHash');
    const ok = await bcrypt.compare(req.body.password, user ? user.passwordHash : DUMMY_HASH);
    if (!user || !ok) throw httpError(401, 'Incorrect email or password');
    setAuthCookie(res, user);
    res.json({ success: true, user: user.toJSON() });
  }));

router.post('/logout', (_req, res) => {
  res.clearCookie(env.COOKIE_NAME);
  res.json({ success: true });
});

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  await req.user.populate('assignedClasses', 'name');
  res.json({ success: true, user: req.user.toJSON(), college: env.COLLEGE_NAME });
}));

module.exports = router;
