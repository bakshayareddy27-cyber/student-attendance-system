const env = require('../config/env');

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

/** Today's date as YYYY-MM-DD in the college's timezone (not the server's UTC day). */
function todayStr(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: env.APP_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

function isValidDateStr(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** "2026-10-10" -> "10 October 2026" */
function formatLongDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

function addDays(s, n) {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

module.exports = { todayStr, isValidDateStr, formatLongDate, addDays };
