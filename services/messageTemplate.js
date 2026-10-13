const env = require('../config/env');
const { formatLongDate, todayStr } = require('../utils/dates');

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Builds the parent message from live database values; nothing here is hardcoded to a student. */
function buildAbsenceMessage({ parentName, studentName, rollNumber, date }) {
  const longDate = formatLongDate(date);
  const when = date === todayStr() ? `today's classes on ${longDate}` : `the classes on ${longDate}`;
  const subject = 'Student Attendance Alert';
  const body = `Your child, ${studentName} (Roll No. ${rollNumber}), has been marked absent for ${when}.`;
  const closing = 'Please contact the college if you need further information.';

  const text = `Dear ${parentName},\n\n${body}\n\n${closing}\n\nRegards,\nCollege Attendance System`;

  const html = `<!doctype html><html><body style="margin:0;background:#f1f3f0;font-family:Arial,Helvetica,sans-serif;color:#16231f">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #dfe5e1">
      <tr><td style="background:#10231f;padding:18px 28px;color:#f2c230;font-size:18px;font-weight:bold">${esc(env.COLLEGE_NAME)}</td></tr>
      <tr><td style="padding:28px">
        <div style="display:inline-block;background:#fce4e4;color:#b42318;font-weight:bold;font-size:13px;padding:5px 12px;border-radius:999px">Absence alert</div>
        <p style="font-size:16px;margin:20px 0 8px">Dear ${esc(parentName)},</p>
        <p style="font-size:16px;line-height:1.55;margin:0 0 16px">Your child, <strong>${esc(studentName)}</strong> (Roll No. ${esc(rollNumber)}), has been marked <strong style="color:#b42318">absent</strong> for ${esc(when)}.</p>
        <p style="font-size:16px;line-height:1.55;margin:0 0 24px">${closing}</p>
        <p style="font-size:15px;margin:0;color:#4a5a55">Regards,<br>College Attendance System</p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;

  return { subject, text, html };
}

module.exports = { buildAbsenceMessage };
