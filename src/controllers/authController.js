import AdminUser from '../models/AdminUser.js';
import Setting from '../models/Setting.js';
import LoginActivity from '../models/LoginActivity.js';
import { generateToken, generateResetToken } from '../utils/generateToken.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { serializeAdminUser, serializeStaffApplication } from '../utils/serializers.js';
import { submitApplication } from './applicationController.js';
import { sendPasswordReset } from '../services/emailService.js';
import { createNotification } from '../services/notificationService.js';
import { logAudit } from '../services/auditService.js';
import { publicUrl, deleteUploadFile } from '../middleware/upload.js';
import { HttpError } from '../utils/api.js';
import env from '../config/env.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9._-]{3,30}$/;
const GENDERS = ['', 'Male', 'Female', 'Other'];

function clientIp(req) {
  const raw = req.ip || req.headers['x-forwarded-for'] || '';
  return raw.toString().split(',')[0].trim();
}

function userAgent(req) {
  return (req.headers['user-agent'] || '').slice(0, 255);
}

async function logLogin({ user, req, status }) {
  try {
    await LoginActivity.create({
      userId: user ? user._id : null,
      userName: user ? user.name : '',
      userEmail: user ? user.email : '',
      email: user ? user.email : '',
      ipAddress: clientIp(req),
      status,
      deviceInfo: userAgent(req),
      userAgent: userAgent(req),
    });
  } catch {
    /* best-effort */
  }
}

async function getMaxAttempts() {
  const s = await Setting.findOne({ key: 'default' }).lean();
  return (s && s.maxLoginAttempts) || 5;
}

export async function login(req, res) {
  const { email, password } = req.body || {};

  if (!email || !password) {
    throw new HttpError(400, 'Email and password are required');
  }

  const user = await AdminUser.findOne({ email: String(email).toLowerCase().trim() }).select('+password');
  const maxAttempts = await getMaxAttempts();

  if (!user) {
    await logLogin({ user: null, req, status: 'failed' });
    throw new HttpError(401, 'Invalid credentials');
  }

  if (user.lockoutUntil && user.lockoutUntil > new Date()) {
    await logLogin({ user, req, status: 'failed' });
    throw new HttpError(423, 'Account temporarily locked. Try again later.');
  }

  const ok = await comparePassword(password, user.password);
  if (!ok) {
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
    if (user.failedLoginAttempts >= maxAttempts) {
      user.lockoutUntil = new Date(Date.now() + 15 * 60 * 1000);
      user.failedLoginAttempts = 0;
    }
    await user.save();
    await logLogin({ user, req, status: 'failed' });
    throw new HttpError(401, 'Invalid credentials');
  }

  if (user.active === false) {
    await logLogin({ user, req, status: 'failed' });
    throw new HttpError(403, 'Your account has been deactivated');
  }

  user.failedLoginAttempts = 0;
  user.lockoutUntil = null;
  user.lastLogin = new Date();
  user.lastLoginIp = clientIp(req);
  await user.save();

  await logLogin({ user, req, status: 'success' });

  const token = generateToken(user);
  return res.json({ token, user: serializeAdminUser(user.toObject()) });
}

/**
 * Public staff application submission. Creates a PENDING application that a
 * Super Admin must approve before the account becomes active (see
 * applicationController.approveApplication). No account or session is created
 * here.
 */
export async function signup(req, res) {
  const app = await submitApplication(req.body || {});
  return res.status(201).json({
    success: true,
    message: 'Application submitted. It will be reviewed by the Super Director.',
    application: serializeStaffApplication(app.toObject()),
  });
}

export async function forgotPassword(req, res) {
  const { email } = req.body || {};
  if (!email) {
    throw new HttpError(400, 'Email is required');
  }

  const user = await AdminUser.findOne({ email: String(email).toLowerCase().trim() });
  if (!user) {
    // Do not reveal whether the account exists.
    return res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
  }

  const token = generateResetToken({ id: user._id.toString(), purpose: 'password_reset' });
  user.resetPasswordToken = token;
  user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
  await user.save();

  const resetUrl = `${env.clientUrl}/reset-password/${token}`;
  const result = await sendPasswordReset(user.email, resetUrl);

  if (!result.success) {
    throw new HttpError(500, 'Could not send reset email. Try again later.');
  }

  return res.json({ success: true, message: 'Reset link sent. Check your inbox.' });
}

export async function resetPassword(req, res) {
  const { token, password } = req.body || {};
  if (!token || !password) {
    throw new HttpError(400, 'Token and new password are required');
  }
  if (String(password).length < 6) {
    throw new HttpError(400, 'Password must be at least 6 characters');
  }

  const user = await AdminUser.findOne({ resetPasswordToken: token }).select('+password');
  if (!user || !user.resetPasswordExpires || user.resetPasswordExpires < new Date()) {
    throw new HttpError(400, 'Reset link is invalid or has expired');
  }

  user.password = await hashPassword(password);
  user.resetPasswordToken = null;
  user.resetPasswordExpires = null;
  user.failedLoginAttempts = 0;
  user.lockoutUntil = null;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  await createNotification({
    type: 'security',
    title: 'Password changed',
    message: `Password for ${user.email} was reset successfully.`,
    createdBy: user._id,
  });

  return res.json({ success: true, message: 'Password updated. You can now sign in.' });
}

export async function changePassword(req, res) {
  const { currentPassword, newPassword, confirmNewPassword } = req.body || {};
  if (!currentPassword || !newPassword || !confirmNewPassword) {
    throw new HttpError(400, 'Current password, new password and confirmation are required');
  }
  if (String(newPassword).length < 8) {
    throw new HttpError(400, 'New password must be at least 8 characters');
  }
  if (!/[a-zA-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
    throw new HttpError(400, 'New password must contain at least one letter and one number');
  }
  if (newPassword !== confirmNewPassword) {
    throw new HttpError(400, 'New passwords do not match');
  }
  if (currentPassword === newPassword) {
    throw new HttpError(400, 'New password must be different from your current password');
  }

  const user = await AdminUser.findById(req.user._id).select('+password');
  const ok = await comparePassword(currentPassword, user.password);
  if (!ok) {
    throw new HttpError(400, 'Current password is incorrect');
  }

  user.password = await hashPassword(newPassword);
  // Invalidate every existing session so the user must sign in again.
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  await logAudit({ action: 'update', module: 'security', details: `Changed own password (${user.email})`, req });
  await createNotification({
    type: 'security',
    title: 'Password changed',
    message: `Password for ${user.email} was changed.`,
    createdBy: user._id,
  });

  return res.json({ success: true, message: 'Password changed successfully. Please sign in again.', requireRelogin: true });
}

export async function getProfile(req, res) {
  return res.json(serializeAdminUser(req.user.toObject()));
}

/**
 * Self-service profile update. Whitelisted fields only — role, active and
 * avatarUrl can never be set here. Changing the email requires the current
 * password as confirmation (no email-verification flow exists in this app).
 */
export async function updateProfile(req, res) {
  const body = req.body || {};
  const user = await AdminUser.findById(req.user._id).select('+password');
  if (!user) throw new HttpError(404, 'User not found');

  const updates = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) throw new HttpError(400, 'Name cannot be empty');
    updates.name = name;
  }
  if (body.firstName !== undefined) updates.firstName = String(body.firstName).trim();
  if (body.lastName !== undefined) updates.lastName = String(body.lastName).trim();

  if (body.username !== undefined) {
    const username = String(body.username).trim().toLowerCase();
    if (username === '') {
      // Remove the field entirely so the sparse unique index stays clean.
      updates.username = undefined;
    } else {
      if (!USERNAME_RE.test(username)) {
        throw new HttpError(400, 'Username must be 3-30 characters using letters, numbers, dots, dashes or underscores');
      }
      const exists = await AdminUser.findOne({ username, _id: { $ne: user._id } });
      if (exists) throw new HttpError(400, 'Username is already taken');
      updates.username = username;
    }
  }

  if (body.phone !== undefined) {
    const phone = String(body.phone).trim();
    if (phone.length > 20) throw new HttpError(400, 'Phone number is too long');
    updates.phone = phone;
  }

  for (const key of ['address', 'city', 'state', 'country', 'pincode']) {
    if (body[key] !== undefined) {
      const value = String(body[key]).trim();
      if (value.length > 120) throw new HttpError(400, `${key} is too long`);
      updates[key] = value;
    }
  }

  if (body.dob !== undefined) {
    if (body.dob === '' || body.dob == null) {
      updates.dob = null;
    } else {
      const d = new Date(body.dob);
      if (Number.isNaN(d.getTime())) throw new HttpError(400, 'Invalid date of birth');
      if (d > new Date()) throw new HttpError(400, 'Date of birth cannot be in the future');
      updates.dob = d;
    }
  }

  if (body.gender !== undefined) {
    const gender = String(body.gender).trim();
    if (!GENDERS.includes(gender)) throw new HttpError(400, 'Invalid gender');
    updates.gender = gender;
  }

  if (body.email !== undefined) {
    const email = String(body.email).toLowerCase().trim();
    if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Invalid email address');
    if (email !== user.email) {
      const ok = await comparePassword(String(body.currentPassword || ''), user.password);
      if (!ok) throw new HttpError(400, 'Enter your current password to change your email');
      const exists = await AdminUser.findOne({ email, _id: { $ne: user._id } });
      if (exists) throw new HttpError(400, 'An account with this email already exists');
      updates.email = email;
    }
  }

  Object.assign(user, updates);
  await user.save();

  await logAudit({ action: 'update', module: 'profile', details: `Updated own profile (${user.email})`, req });

  return res.json(serializeAdminUser(user.toObject()));
}

export async function uploadProfilePicture(req, res) {
  if (!req.file) {
    throw new HttpError(400, 'No file uploaded — use multipart/form-data with field "file"');
  }
  const user = await AdminUser.findById(req.user._id);
  if (!user) throw new HttpError(404, 'User not found');

  const previous = user.avatarUrl;
  user.avatarUrl = publicUrl(req.file.filename);
  await user.save();

  await logAudit({ action: 'update', module: 'profile', details: 'Updated profile picture', req });
  if (previous) deleteUploadFile(previous);

  return res.json(serializeAdminUser(user.toObject()));
}

export async function deleteProfilePicture(req, res) {
  const user = await AdminUser.findById(req.user._id);
  if (!user) throw new HttpError(404, 'User not found');

  const previous = user.avatarUrl;
  user.avatarUrl = '';
  await user.save();

  await logAudit({ action: 'update', module: 'profile', details: 'Removed profile picture', req });
  if (previous) deleteUploadFile(previous);

  return res.json(serializeAdminUser(user.toObject()));
}

export default { login, signup, forgotPassword, resetPassword, changePassword, getProfile, updateProfile, uploadProfilePicture, deleteProfilePicture };