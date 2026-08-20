import AdminUser from '../models/AdminUser.js';
import Setting from '../models/Setting.js';
import LoginActivity from '../models/LoginActivity.js';
import { generateToken, generateResetToken } from '../utils/generateToken.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { serializeAdminUser, serializeStaffApplication } from '../utils/serializers.js';
import { submitApplication } from './applicationController.js';
import { sendPasswordReset } from '../services/emailService.js';
import { createNotification } from '../services/notificationService.js';
import { HttpError } from '../utils/api.js';
import env from '../config/env.js';

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
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    throw new HttpError(400, 'Current and new passwords are required');
  }
  if (String(newPassword).length < 6) {
    throw new HttpError(400, 'New password must be at least 6 characters');
  }

  const user = await AdminUser.findById(req.user._id).select('+password');
  const ok = await comparePassword(currentPassword, user.password);
  if (!ok) {
    throw new HttpError(400, 'Current password is incorrect');
  }

  user.password = await hashPassword(newPassword);
  await user.save();

  return res.json({ success: true, message: 'Password changed successfully.' });
}

export async function getProfile(req, res) {
  return res.json(serializeAdminUser(req.user.toObject()));
}

export default { login, signup, forgotPassword, resetPassword, changePassword, getProfile };