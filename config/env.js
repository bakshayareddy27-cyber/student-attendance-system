require('dotenv').config();

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT) || 3000,
  MONGO_URI: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/attendance_system',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  COOKIE_NAME: 'attendance_token',
  APP_TZ: process.env.APP_TZ || 'Asia/Kolkata',
  COLLEGE_NAME: process.env.COLLEGE_NAME || 'MLR Institute of Technology',
  // Email
  EMAIL_MODE: (process.env.EMAIL_MODE || '').toLowerCase(), // smtp | ethereal | outbox | '' (auto)
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: Number(process.env.SMTP_PORT) || 587,
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  MAIL_FROM: process.env.MAIL_FROM || 'College Attendance System <no-reply@college.edu>',
  // Notification retry policy
  NOTIFY_MAX_ATTEMPTS: Number(process.env.NOTIFY_MAX_ATTEMPTS) || 5,
  NOTIFY_BASE_DELAY_MS: Number(process.env.NOTIFY_BASE_DELAY_MS) || 30_000,
  NOTIFY_LOCK_MS: Number(process.env.NOTIFY_LOCK_MS) || 120_000,
  NOTIFY_POLL_MS: Number(process.env.NOTIFY_POLL_MS) || 60_000,
};

if (env.NODE_ENV === 'production' && env.JWT_SECRET === 'dev-only-secret-change-me') {
  throw new Error('Set a strong JWT_SECRET in production.');
}

module.exports = env;
