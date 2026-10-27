import AdminUser from '../models/AdminUser.js';
import StaffApplication from '../models/StaffApplication.js';
import { hashPassword } from '../utils/password.js';
import { serializeStaffApplication } from '../utils/serializers.js';
import { HttpError } from '../utils/api.js';
import { logAudit } from '../services/auditService.js';
import { createNotification } from '../services/notificationService.js';
import { sendStaffApplicationApproved, sendStaffApplicationRejected } from '../services/emailService.js';

const REQUESTABLE_ROLES = ['Admin', 'Manager', 'Receptionist'];
const VALID_STATUSES = ['pending', 'approved', 'rejected'];

/**
 * Core submission logic shared by the public /admin/signup route.
 * Throws HttpError on any invalid input so the caller formats the response.
 */
export async function submitApplication({ name, email, password, requestedRole, note } = {}) {
  if (!name || !email || !password) {
    throw new HttpError(400, 'Name, email and password are required');
  }
  if (String(password).length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    throw new HttpError(400, 'Password must be at least 8 characters with a letter and a number');
  }
  const cleanEmail = String(email).toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new HttpError(400, 'Please provide a valid email address');
  }

  const role = requestedRole && REQUESTABLE_ROLES.includes(requestedRole) ? requestedRole : 'Receptionist';
  if (requestedRole === 'Super Admin') {
    throw new HttpError(400, 'Super Admin accounts cannot be requested');
  }

  const [existingUser, existingApp] = await Promise.all([
    AdminUser.findOne({ email: cleanEmail }),
    StaffApplication.findOne({ email: cleanEmail }),
  ]);
  if (existingUser) {
    throw new HttpError(400, 'An account with this email already exists');
  }
  if (existingApp && existingApp.status === 'pending') {
    throw new HttpError(400, 'An application for this email is already under review');
  }

  const passwordHash = await hashPassword(password);
  const cleanName = String(name).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 120);
  const cleanNote = String(note || '').replace(/<[^>]*>/g, '').trim().slice(0, 1000);

  // A rejected applicant may reapply. The unique email index stays intact:
  // reuse the existing record and reset it back to pending.
  if (existingApp) {
    existingApp.name = cleanName;
    existingApp.requestedRole = role;
    existingApp.passwordHash = passwordHash;
    existingApp.note = cleanNote;
    existingApp.status = 'pending';
    existingApp.reviewNote = '';
    existingApp.reviewedBy = null;
    existingApp.reviewedAt = null;
    await existingApp.save();
  }

  let app = existingApp;
  if (!app) {
    try {
      app = await StaffApplication.create({
        name: cleanName,
        email: cleanEmail,
        requestedRole: role,
        passwordHash,
        note: cleanNote,
        status: 'pending',
      });
    } catch (err) {
      if (err && err.code === 11000) {
        throw new HttpError(400, 'An application for this email is already under review');
      }
      throw err;
    }
  }

  await createNotification({
    type: 'info',
    title: 'New staff application',
    message: `${cleanName} (${cleanEmail}) applied for ${role} access`,
    link: 'applications',
  });

  return app;
}

export async function createApplication(req, res) {
  const app = await submitApplication(req.body || {});
  return res.status(201).json({
    success: true,
    message: 'Application submitted. It will be reviewed by the Super Director.',
    application: serializeStaffApplication(app.toObject()),
  });
}

export async function listApplications(req, res) {
  const { status } = req.query || {};
  const filter = {};
  if (status && VALID_STATUSES.includes(status)) {
    filter.status = status;
  }
  const apps = await StaffApplication.find(filter).sort({ createdAt: -1 }).lean();
  return res.json(apps.map(serializeStaffApplication));
}

export async function approveApplication(req, res) {
  const app = await StaffApplication.findById(req.params.id).select('+passwordHash');
  if (!app) {
    throw new HttpError(404, 'Application not found');
  }
  if (app.status !== 'pending') {
    throw new HttpError(400, 'This application has already been reviewed');
  }

  const existing = await AdminUser.findOne({ email: app.email });
  if (existing) {
    throw new HttpError(400, 'An account with this email already exists');
  }

  await AdminUser.create({
    name: app.name,
    email: app.email,
    role: app.requestedRole,
    password: app.passwordHash,
  });

  app.status = 'approved';
  app.reviewedBy = req.user._id;
  app.reviewedAt = new Date();
  await app.save();

  await sendStaffApplicationApproved(app.email, app.name, app.requestedRole);
  await logAudit({
    action: 'approve',
    module: 'applications',
    details: `Approved staff application for ${app.email} as ${app.requestedRole}`,
    req,
  });
  await createNotification({
    type: 'info',
    title: 'Staff application approved',
    message: `${app.name} (${app.email}) is now an active ${app.requestedRole}`,
    link: 'users',
    createdBy: req.user._id,
  });

  return res.json(serializeStaffApplication(app.toObject()));
}

export async function rejectApplication(req, res) {
  const app = await StaffApplication.findById(req.params.id);
  if (!app) {
    throw new HttpError(404, 'Application not found');
  }
  if (app.status !== 'pending') {
    throw new HttpError(400, 'This application has already been reviewed');
  }

  const reason = String((req.body || {}).reason || '').slice(0, 500);
  app.status = 'rejected';
  app.reviewNote = reason;
  app.reviewedBy = req.user._id;
  app.reviewedAt = new Date();
  await app.save();

  await sendStaffApplicationRejected(app.email, app.name, reason);
  await logAudit({
    action: 'reject',
    module: 'applications',
    details: `Rejected staff application for ${app.email}${reason ? ` (${reason})` : ''}`,
    req,
  });

  return res.json(serializeStaffApplication(app.toObject()));
}

export async function deleteApplication(req, res) {
  const app = await StaffApplication.findByIdAndDelete(req.params.id);
  if (!app) {
    throw new HttpError(404, 'Application not found');
  }
  await logAudit({
    action: 'delete',
    module: 'applications',
    details: `Deleted staff application for ${app.email}`,
    req,
  });
  return res.json({ success: true });
}

export default { submitApplication, createApplication, listApplications, approveApplication, rejectApplication, deleteApplication };