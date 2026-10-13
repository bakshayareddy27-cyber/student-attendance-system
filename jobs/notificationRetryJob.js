const env = require('../config/env');
const { processDue } = require('../services/notificationService');

let timer = null;

/** Polls for due notifications (new, or failed with an elapsed backoff). */
function startRetryJob() {
  if (timer) return;
  const tick = () => processDue().catch((e) => console.error('[retry-job]', e));
  tick(); // pick up anything left over from before a restart
  timer = setInterval(tick, env.NOTIFY_POLL_MS);
  timer.unref();
}

function stopRetryJob() { if (timer) clearInterval(timer); timer = null; }

module.exports = { startRetryJob, stopRetryJob };
