const { mongoose } = require('../config/db');
const { Schema } = mongoose;
const ObjectId = Schema.Types.ObjectId;

/* ---------- users ---------- */
const userSchema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['admin', 'faculty'], required: true },
  assignedClasses: [{ type: ObjectId, ref: 'Class' }],
}, { timestamps: true });

userSchema.set('toJSON', { transform: (_d, ret) => { delete ret.passwordHash; delete ret.__v; return ret; } });

/* ---------- classes ---------- */
const classSchema = new Schema({
  name: { type: String, required: true, unique: true, trim: true },
  department: { type: String, required: true, trim: true },
  year: { type: Number, required: true, min: 1, max: 6 },
  section: { type: String, trim: true, default: '' },
}, { timestamps: true });

/* ---------- students ---------- */
const studentSchema = new Schema({
  studentId: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true, trim: true },
  rollNumber: { type: String, required: true, trim: true },
  classId: { type: ObjectId, ref: 'Class', required: true, index: true },
  parentName: { type: String, required: true, trim: true },
  parentEmail: { type: String, required: true, lowercase: true, trim: true },
  parentPhone: { type: String, trim: true, default: '' },
}, { timestamps: true });
// A roll number is unique inside a class.
studentSchema.index({ classId: 1, rollNumber: 1 }, { unique: true });

/* ---------- attendance ---------- */
const attendanceSchema = new Schema({
  studentId: { type: ObjectId, ref: 'Student', required: true },
  classId: { type: ObjectId, ref: 'Class', required: true },
  date: { type: String, required: true },            // "YYYY-MM-DD" in the college timezone
  session: { type: String, default: 'DAILY' },       // lets per-period marking be added without a schema change
  status: { type: String, enum: ['PRESENT', 'ABSENT'], required: true },
  markedBy: { type: ObjectId, ref: 'User' },
  notificationStatus: { type: String, enum: ['NOT_REQUIRED', 'PENDING', 'SENT', 'FAILED'], default: 'NOT_REQUIRED' },
}, { timestamps: true });
// One record per student, class, date and session: this is what prevents duplicates.
attendanceSchema.index({ studentId: 1, classId: 1, date: 1, session: 1 }, { unique: true });
attendanceSchema.index({ classId: 1, date: 1 });

/* ---------- notifications ---------- */
const notificationSchema = new Schema({
  studentId: { type: ObjectId, ref: 'Student', required: true, index: true },
  attendanceId: { type: ObjectId, ref: 'Attendance', required: true, unique: true }, // at most one alert per absence
  parentContact: { type: String, required: true },
  channel: { type: String, default: 'EMAIL' },
  subject: String,
  message: { type: String, required: true },
  html: String,
  status: { type: String, enum: ['PENDING', 'SENDING', 'SENT', 'FAILED', 'CANCELLED'], default: 'PENDING', index: true },
  attempts: { type: Number, default: 0 },
  lastError: String,
  nextRetryAt: { type: Date, default: () => new Date() },
  lockedAt: Date,
  sentAt: Date,
  previewUrl: String,
}, { timestamps: true });

module.exports = {
  User: mongoose.models.User || mongoose.model('User', userSchema),
  Class: mongoose.models.Class || mongoose.model('Class', classSchema),
  Student: mongoose.models.Student || mongoose.model('Student', studentSchema),
  Attendance: mongoose.models.Attendance || mongoose.model('Attendance', attendanceSchema),
  Notification: mongoose.models.Notification || mongoose.model('Notification', notificationSchema),
};
