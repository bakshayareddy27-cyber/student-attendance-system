const path = require('path');
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const env = require('./config/env');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();
const root = __dirname;

app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: { 'upgrade-insecure-requests': null, 'script-src': ["'self'"], 'img-src': ["'self'", 'data:'] },
  },
}));
if (env.NODE_ENV !== 'test') app.use(morgan('dev'));
app.use(express.json({ limit: '200kb' }));
app.use(cookieParser());

// Front-end libraries are served from node_modules so the app works offline (no CDN needed).
app.use('/vendor/bootstrap', express.static(path.join(root, 'node_modules/bootstrap/dist')));
app.use('/vendor/bootstrap-icons', express.static(path.join(root, 'node_modules/bootstrap-icons/font')));
app.use('/vendor/fonts/bricolage', express.static(path.join(root, 'node_modules/@fontsource-variable/bricolage-grotesque')));
app.use('/vendor/fonts/figtree', express.static(path.join(root, 'node_modules/@fontsource-variable/figtree')));
app.use(express.static(path.join(root, 'public'), { extensions: ['html'] }));

app.get('/api/health', (_req, res) => res.json({ success: true, status: 'ok' }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/classes', require('./routes/classes'));
app.use('/api/students', require('./routes/students'));
app.use('/api/faculty', require('./routes/faculty'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/notifications', require('./routes/notifications'));

app.get('/', (_req, res) => res.redirect('/dashboard.html'));
app.use(notFound);
app.use(errorHandler);

module.exports = app;
