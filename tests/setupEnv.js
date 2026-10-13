process.env.NODE_ENV = 'test';
process.env.EMAIL_MODE = 'outbox';          // no network: emails are stored, not delivered
process.env.JWT_SECRET = 'test-secret';
process.env.NOTIFY_BASE_DELAY_MS = '50';
process.env.NOTIFY_POLL_MS = '3600000';
