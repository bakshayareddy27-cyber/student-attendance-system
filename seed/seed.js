/* Run with: npm run seed   (safe to re-run: it clears the collections and re-inserts demo data) */
const bcrypt = require('bcryptjs');
const env = require('../config/env');
const { connectDB, mongoose } = require('../config/db');
const { User, Class, Student, Attendance, Notification } = require('../models');
const { buildAbsenceMessage } = require('../services/messageTemplate');
const { todayStr, addDays } = require('../utils/dates');

const CLASS_DATA = [
  { name: 'III-CSM-B', department: 'CSE (AI & ML)', year: 3, section: 'B', firstRoll: 21, students: [
    ['Ananya Sharma', 'Rajesh Sharma'], ['Vikram Reddy', 'Suresh Reddy'], ['Rahul Kumar', 'Sunita Kumar'], ['Priya Nair', 'Gopal Nair'],
    ['Karthik Rao', 'Lakshmi Rao'], ['Sneha Patel', 'Mahesh Patel'], ['Arjun Mehta', 'Kavita Mehta'], ['Divya Iyer', 'Ramesh Iyer'] ] },
  { name: 'II-CSD-A', department: 'CSE (Data Science)', year: 2, section: 'A', firstRoll: 1, students: [
    ['Aditya Verma', 'Anil Verma'], ['Meghana Gupta', 'Rekha Gupta'], ['Rohan Das', 'Subrata Das'], ['Ishita Singh', 'Harpreet Singh'],
    ['Nikhil Joshi', 'Prakash Joshi'], ['Pooja Menon', 'Vijay Menon'], ['Sai Teja', 'Venkat Rao'], ['Fatima Khan', 'Imran Khan'] ] },
];
// Students who miss more classes, so the "below 75%" highlight has something to show.
const FREQUENT_ABSENTEES = new Set(['Rahul Kumar', 'Rohan Das']);

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');

function parentEmail(parentName, roll) {
  const base = process.env.SEED_PARENT_EMAIL;
  if (base && base.includes('@')) { const [u, d] = base.split('@'); return `${u}+roll${roll}@${d}`; }
  return `${slug(parentName)}@example.com`;
}

// Small deterministic generator so re-seeding gives the same demo data.
function rng(seed) { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }

(async () => {
  await connectDB();
  await Promise.all([User, Class, Student, Attendance, Notification].map((M) => M.deleteMany({})));
  // Make sure indexes (including the unique ones) exist before inserting.
  await Promise.all([User, Class, Student, Attendance, Notification].map((M) => M.syncIndexes()));

  const classes = await Class.insertMany(CLASS_DATA.map(({ name, department, year, section }) => ({ name, department, year, section })));

  const hash = (p) => bcrypt.hash(p, 10);
  await User.create({ name: 'Admin Office', email: 'admin@college.edu', passwordHash: await hash('Admin@123'), role: 'admin' });
  await User.create({ name: 'Dr. Meera Iyer', email: 'meera@college.edu', passwordHash: await hash('Faculty@123'), role: 'faculty', assignedClasses: [classes[0]._id] });
  await User.create({ name: 'Prof. Arun Sharma', email: 'arun@college.edu', passwordHash: await hash('Faculty@123'), role: 'faculty', assignedClasses: [classes[1]._id] });
  const marker = await User.findOne({ email: 'meera@college.edu' });

  const students = [];
  CLASS_DATA.forEach((c, ci) => c.students.forEach(([name, parentName], i) => {
    const roll = String(c.firstRoll + i);
    students.push({
      studentId: `${c.name.replace(/-/g, '')}${roll.padStart(2, '0')}`, name, rollNumber: roll, classId: classes[ci]._id,
      parentName, parentEmail: parentEmail(parentName, roll),
      parentPhone: `+91 98${String(48000000 + ci * 1000 + i * 137).padStart(8, '0')}`,
    });
  }));
  const created = await Student.insertMany(students);

  // ~2 weeks of history (Mon-Sat), today excluded so you can mark today live in the demo.
  const days = [];
  for (let n = 1; days.length < 12; n += 1) {
    const d = addDays(todayStr(), -n);
    if (new Date(`${d}T00:00:00Z`).getUTCDay() !== 0) days.push(d);
  }
  const rand = rng(42);
  const attendance = [];
  for (const s of created) {
    for (const date of days) {
      const absentChance = FREQUENT_ABSENTEES.has(s.name) ? 0.4 : 0.08;
      attendance.push({
        studentId: s._id, classId: s.classId, date, session: 'DAILY', markedBy: marker._id,
        status: rand() < absentChance ? 'ABSENT' : 'PRESENT', notificationStatus: 'NOT_REQUIRED',
      });
    }
  }
  const inserted = await Attendance.insertMany(attendance);

  const studentById = new Map(created.map((s) => [String(s._id), s]));
  const alerts = [];
  for (const a of inserted.filter((x) => x.status === 'ABSENT')) {
    const s = studentById.get(String(a.studentId));
    const m = buildAbsenceMessage({ parentName: s.parentName, studentName: s.name, rollNumber: s.rollNumber, date: a.date });
    const _id = new mongoose.Types.ObjectId();
    alerts.push({
      _id, studentId: s._id, attendanceId: a._id, parentContact: s.parentEmail, channel: 'EMAIL', subject: m.subject, message: m.text, html: m.html,
      status: 'SENT', attempts: 1, sentAt: new Date(`${a.date}T09:30:00+05:30`), previewUrl: `/api/notifications/${_id}/preview`,
    });
  }
  const notes = await Notification.insertMany(alerts);
  await Attendance.updateMany({ _id: { $in: notes.map((n) => n.attendanceId) } }, { $set: { notificationStatus: 'SENT' } });

  console.log('\nSeed complete.');
  console.log(`  Classes: ${classes.length}   Students: ${created.length}   Attendance records: ${inserted.length}   Past alerts: ${notes.length}\n`);
  console.log('  Sign in with:');
  console.log('    Admin    admin@college.edu   Admin@123');
  console.log('    Faculty  meera@college.edu   Faculty@123   (III-CSM-B)');
  console.log('    Faculty  arun@college.edu    Faculty@123   (II-CSD-A)\n');
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
