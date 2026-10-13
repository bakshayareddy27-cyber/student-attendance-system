const bcrypt = require('bcryptjs');
const request = require('supertest');
const { connectDB, mongoose } = require('../config/db');
const { User, Class, Student, Attendance, Notification } = require('../models');
const { processDue } = require('../services/notificationService');

let mongod;

/** Uses TEST_MONGO_URI if provided (any MongoDB), otherwise spins up an in-memory MongoDB. */
async function connect() {
  let uri = process.env.TEST_MONGO_URI;
  if (!uri) {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    mongod = await MongoMemoryServer.create();
    uri = mongod.getUri('attendance_test');
  }
  await connectDB(uri);
  await Promise.all([User, Class, Student, Attendance, Notification].map((M) => M.syncIndexes()));
}

async function disconnect() {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
}

async function clear() {
  await Promise.all([User, Class, Student, Attendance, Notification].map((M) => M.deleteMany({})));
}

/** Two classes, an admin, a faculty member for class A and one for class B, and 3 students in class A. */
async function seedBasics() {
  const [a, b] = await Class.insertMany([
    { name: 'CLASS-A', department: 'CSE', year: 3, section: 'A' },
    { name: 'CLASS-B', department: 'CSE', year: 2, section: 'B' },
  ]);
  const hash = await bcrypt.hash('Passw0rd!', 4);
  const admin = await User.create({ name: 'Admin', email: 'admin@t.edu', passwordHash: hash, role: 'admin' });
  const fa = await User.create({ name: 'Fac A', email: 'fa@t.edu', passwordHash: hash, role: 'faculty', assignedClasses: [a._id] });
  const fb = await User.create({ name: 'Fac B', email: 'fb@t.edu', passwordHash: hash, role: 'faculty', assignedClasses: [b._id] });
  const students = await Student.insertMany([
    { studentId: 'S1', name: 'Rahul Kumar', rollNumber: '23', classId: a._id, parentName: 'Sunita Kumar', parentEmail: 'sunita@example.com' },
    { studentId: 'S2', name: 'Ananya Sharma', rollNumber: '24', classId: a._id, parentName: 'Rajesh Sharma', parentEmail: 'rajesh@example.com' },
    { studentId: 'S3', name: 'Vikram Reddy', rollNumber: '25', classId: a._id, parentName: 'Suresh Reddy', parentEmail: 'suresh@example.com' },
  ]);
  return { a, b, admin, fa, fb, students };
}

async function login(app, email, password = 'Passw0rd!') {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${res.text}`);
  return agent;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, { tries = 60, every = 50 } = {}) {
  for (let i = 0; i < tries; i += 1) { const v = await fn(); if (v) return v; await sleep(every); }
  throw new Error('waitFor timed out');
}
/** Runs the notification worker until it is idle (the background run may still be finishing). */
async function drain() {
  for (let i = 0; i < 40; i += 1) { const r = await processDue(); if (!r.skipped) return r; await sleep(50); }
  throw new Error('worker never became idle');
}

module.exports = { connect, disconnect, clear, seedBasics, login, waitFor, drain, sleep };
