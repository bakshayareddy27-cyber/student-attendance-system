class HttpError extends Error {
  constructor(status, message, errors) { super(message); this.status = status; this.errors = errors; }
}
const httpError = (status, message, errors) => new HttpError(status, message, errors);

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function notFound(req, res, next) {
  if (req.originalUrl.startsWith('/api/')) return next(httpError(404, 'Endpoint not found'));
  res.status(404).sendFile(require('path').join(__dirname, '..', 'public', 'login.html'));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let message = err.message || 'Something went wrong';
  let errors = err.errors;

  if (err.code === 11000) {           // Mongo duplicate key
    status = 409;
    // Real MongoDB supplies keyPattern; the message text is checked too so other servers still get a clear message.
    const field = `${Object.keys(err.keyPattern || err.keyValue || {}).join(',')} ${err.message || ''}`;
    message = /rollNumber/.test(field) ? 'That roll number is already used in this class'
      : /email/.test(field) ? 'That email is already registered'
      : /studentId/.test(field) && !/classId|date/.test(field) ? 'That student ID already exists'
      : /name/.test(field) ? 'That name already exists'
      : 'This record already exists';
  } else if (err.name === 'ValidationError' && err.errors) {
    status = 400;
    message = 'Validation failed';
    errors = Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v.message]));
  } else if (err.name === 'CastError') {
    status = 400; message = 'Invalid identifier';
  } else if (err.type === 'entity.parse.failed') {
    status = 400; message = 'Malformed JSON body';
  }

  if (status >= 500) console.error('[error]', err);
  res.status(status).json({ success: false, message: status >= 500 ? 'Internal server error' : message, ...(errors ? { errors } : {}) });
}

module.exports = { HttpError, httpError, asyncHandler, notFound, errorHandler };
