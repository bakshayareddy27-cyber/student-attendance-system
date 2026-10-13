const { z } = require('zod');
const { httpError } = require('./errorHandler');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

/** validate(schema, 'body' | 'query' | 'params') replaces req[source] with the parsed (trimmed, typed) value. */
const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const errors = {};
    for (const issue of result.error.issues) errors[issue.path.join('.') || '_'] = issue.message;
    return next(httpError(400, Object.values(errors)[0] || 'Validation failed', errors));
  }
  if (source === 'query') Object.defineProperty(req, 'query', { value: result.data, writable: true });
  else req[source] = result.data;
  next();
};

module.exports = { validate, z, objectId, dateStr };
