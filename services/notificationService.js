const env = require('../config/env');
const { Notification, Attendance, Student } = require('../models');
const emailNotifier = require('../notifiers/emailNotifier');
const { buildAbsenceMessage } = require('./messageTemplate');

const backoffMs = (attempts) => env.NOTIFY_BASE_DELAY_MS * 2 ** Math.max(0, attempts - 1); // 30s, 1m, 2m, 4m ...

/**
 * Creates (at most) one notification per absence.
 * attendanceId is unique, so a duplicate save can never create a second alert.
 * Returns true only when a new alert was queued (or a cancelled one re-activated).
 */
async function queueAbsenceNotification(attendance, student) {
  const content = buildAbsenceMessage({
    parentName: student.parentName, studentName: student.name, rollNumber: student.rollNumber, date: attendance.date,
  });
  const fields = {
    studentId: student._id, parentContact: student.parentEmail, channel: 'EMAIL',
    subject: content.subject, message: content.text, html: content.html,
  };

  const existing = await Notification.findOne({ attendanceId: attendance._id });
  if (existing) {
    // The only state we re-queue is CANCELLED: the absence was withdrawn before the parent was told, then re-marked.
    if (existing.status !== 'CANCELLED') return false;
    await Notification.updateOne({ _id: existing._id, status: 'CANCELLED' },
      { $set: { ...fields, status: 'PENDING', attempts: 0, lastError: null, nextRetryAt: new Date() } });
    return true;
  }
  try {
    await Notification.create({ ...fields, attendanceId: attendance._id, status: 'PENDING', nextRetryAt: new Date() });
    return true;
  } catch (e) {
    if (e.code === 11000) return false; // lost a race with a concurrent save: the alert already exists
    throw e;
  }
}

/** A correction (Absent -> Present) cancels alerts that have not gone out yet so parents are not sent a false alarm. */
async function cancelUnsent(attendanceIds) {
  if (!attendanceIds.length) return;
  await Notification.updateMany(
    { attendanceId: { $in: attendanceIds }, status: { $in: ['PENDING', 'FAILED'] } },
    { $set: { status: 'CANCELLED' } },
  );
}

/**
 * Atomically claims ONE due notification. findOneAndUpdate is a single atomic step in MongoDB,
 * so overlapping runs or several server instances can never claim (and email) the same alert twice.
 * Stale SENDING claims (crashed worker) are recovered after NOTIFY_LOCK_MS.
 */
async function claimNext() {
  const now = new Date();
  return Notification.findOneAndUpdate(
    {
      attempts: { $lt: env.NOTIFY_MAX_ATTEMPTS },
      $or: [
        { status: { $in: ['PENDING', 'FAILED'] }, nextRetryAt: { $lte: now } },
        { status: 'SENDING', lockedAt: { $lt: new Date(now.getTime() - env.NOTIFY_LOCK_MS) } },
      ],
    },
    { $set: { status: 'SENDING', lockedAt: now }, $inc: { attempts: 1 } },
    { returnDocument: 'after', sort: { nextRetryAt: 1 } },
  );
}

async function deliver(n) {
  try {
    const result = await emailNotifier.send({ to: n.parentContact, subject: n.subject, text: n.message, html: n.html });
    const previewUrl = result.previewUrl || (result.mode === 'outbox' ? `/api/notifications/${n._id}/preview` : undefined);
    await Notification.updateOne({ _id: n._id }, {
      $set: { status: 'SENT', sentAt: new Date(), lastError: null, nextRetryAt: null, lockedAt: null, previewUrl },
    });
    await Attendance.updateOne({ _id: n.attendanceId }, { $set: { notificationStatus: 'SENT' } });
    return 'SENT';
  } catch (err) {
    const exhausted = n.attempts >= env.NOTIFY_MAX_ATTEMPTS;
    await Notification.updateOne({ _id: n._id }, {
      $set: {
        status: 'FAILED', lastError: String(err.message || err).slice(0, 300), lockedAt: null,
        nextRetryAt: exhausted ? null : new Date(Date.now() + backoffMs(n.attempts)),
      },
    });
    await Attendance.updateOne({ _id: n.attendanceId }, { $set: { notificationStatus: 'FAILED' } });
    console.warn(`[notify] ${n._id} failed (attempt ${n.attempts}/${env.NOTIFY_MAX_ATTEMPTS}): ${err.message}`);
    return 'FAILED';
  }
}

let running = false;
/** Sends every notification that is due. Safe to call from anywhere, any time. */
async function processDue(limit = 100) {
  if (running) return { sent: 0, failed: 0, skipped: true };
  running = true;
  const summary = { sent: 0, failed: 0 };
  try {
    for (let i = 0; i < limit; i += 1) {
      const n = await claimNext();
      if (!n) break;
      const outcome = await deliver(n);
      if (outcome === 'SENT') summary.sent += 1; else summary.failed += 1;
    }
  } finally { running = false; }
  return summary;
}

/** Manual retry from the admin screen: resets the attempt counter and sends right away. */
async function retryNow(id) {
  const n = await Notification.findOneAndUpdate(
    { _id: id, status: { $in: ['FAILED', 'PENDING'] } },
    { $set: { status: 'PENDING', attempts: 0, nextRetryAt: new Date(), lastError: null } },
    { returnDocument: 'after' },
  );
  if (n) processDue().catch((e) => console.error('[notify]', e));
  return n;
}

/** Fire-and-forget so the faculty's save request returns immediately. */
const kick = () => setImmediate(() => processDue().catch((e) => console.error('[notify]', e)));

module.exports = { queueAbsenceNotification, cancelUnsent, processDue, retryNow, kick, backoffMs };
