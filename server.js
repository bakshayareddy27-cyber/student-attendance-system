const app = require('./app');
const env = require('./config/env');
const { connectDB } = require('./config/db');
const { startRetryJob } = require('./jobs/notificationRetryJob');

(async () => {
  try {
    await connectDB();
    console.log('[db] Connected to MongoDB');
    app.listen(env.PORT, () => {
      console.log(`[server] http://localhost:${env.PORT}`);
      startRetryJob();
    });
  } catch (err) {
    console.error('[startup] Could not connect to MongoDB. Is it running? Check MONGO_URI in .env');
    console.error(err.message);
    process.exit(1);
  }
})();
