const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { User } = require('../models');
const { httpError, asyncHandler } = require('./errorHandler');

function signToken(user) {
  return jwt.sign({ id: String(user._id), role: user.role }, env.JWT_SECRET, { expiresIn: '8h' });
}

function setAuthCookie(res, user) {
  res.cookie(env.COOKIE_NAME, signToken(user), {
    httpOnly: true, sameSite: 'lax', secure: env.NODE_ENV === 'production', maxAge: 8 * 3600 * 1000,
  });
}

/** Loads the user on every request so deleted or demoted accounts lose access immediately. */
const requireAuth = asyncHandler(async (req, _res, next) => {
  const token = req.cookies && req.cookies[env.COOKIE_NAME];
  if (!token) throw httpError(401, 'Please sign in');
  let payload;
  try { payload = jwt.verify(token, env.JWT_SECRET); } catch { throw httpError(401, 'Your session has expired. Please sign in again'); }
  const user = await User.findById(payload.id);
  if (!user) throw httpError(401, 'Account no longer exists');
  req.user = user;
  next();
});

const requireRole = (...roles) => (req, _res, next) =>
  roles.includes(req.user.role) ? next() : next(httpError(403, 'You do not have permission to do that'));

/** Faculty may only touch the classes assigned to them; admins may touch any. */
function canAccessClass(user, classId) {
  if (user.role === 'admin') return true;
  return (user.assignedClasses || []).some((c) => String(c) === String(classId));
}
function assertClassAccess(user, classId) {
  if (!canAccessClass(user, classId)) throw httpError(403, 'This class is not assigned to you');
}
/** Class ids a user may see, or null for "all classes". */
const scopeClassIds = (user) => (user.role === 'admin' ? null : (user.assignedClasses || []).map(String));

module.exports = { signToken, setAuthCookie, requireAuth, requireRole, canAccessClass, assertClassAccess, scopeClassIds };
