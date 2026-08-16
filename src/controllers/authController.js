import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { UserModel } from '../models/UserModel.js';
import { AuditModel } from '../models/AuditModel.js';
import { JWT_CONFIG } from '../config/jwt.js';
import { sendSuccess, sendError, handleError } from '../utils/responseHandler.js';
import { sendMail } from '../services/emailService.js';
import { queryOne, run } from '../config/db.js';

const PASSWORD_MIN_LENGTH = 6;
// Roles that may be self-assigned via open signup. Super Admin can never be
// obtained through the public signup endpoint.
const SIGNUP_ALLOWED_ROLES = ['Admin', 'Manager', 'Receptionist'];

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getFrontendBaseUrl() {
  const clientUrl = process.env.CLIENT_URL;
  if (clientUrl) return clientUrl.split(',')[0].trim().replace(/\/$/, '');
  return 'http://localhost:5173';
}

export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return sendError(res, 'Email and password are required', 400);
    }

    const user = UserModel.findByEmail(email);
    if (!user) {
      AuditModel.logLoginActivity(email, 'failed', req.ip, req.headers['user-agent']);
      return sendError(res, 'Invalid credentials', 401);
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      AuditModel.logLoginActivity(email, 'failed', req.ip, req.headers['user-agent']);
      return sendError(res, 'Invalid credentials', 401);
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      JWT_CONFIG.secret,
      { expiresIn: JWT_CONFIG.expiresIn }
    );

    AuditModel.logLoginActivity(email, 'success', req.ip, req.headers['user-agent']);
    AuditModel.logAudit(user.name, 'ADMIN_LOGIN', 'User logged in successfully', req.ip);

    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax'
    });

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar_url: user.avatar_url,
        phone: user.phone
      }
    });
  } catch (err) {
    return handleError(res, err);
  }
};

export const adminSignup = async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;
    if (!name || !email || !password) {
      return sendError(res, 'Name, email, and password are required', 400);
    }
    if (String(password).length < PASSWORD_MIN_LENGTH) {
      return sendError(res, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`, 400);
    }

    const existing = UserModel.findByEmail(email);
    if (existing) {
      return sendError(res, 'User with this email already exists', 400);
    }

    // Never allow self-registration as Super Admin.
    const requestedRole = role || 'Admin';
    const finalRole = SIGNUP_ALLOWED_ROLES.includes(requestedRole) ? requestedRole : 'Admin';

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = `usr-${uuidv4().slice(0, 8)}`;

    const newUser = UserModel.create({
      id: userId,
      name,
      email,
      password: hashedPassword,
      role: finalRole,
      phone: phone || null
    });

    AuditModel.logAudit('System', 'USER_SIGNUP', `Created new admin user: ${email} (${finalRole})`, req.ip);

    return res.status(201).json({
      message: 'Account created successfully',
      user: newUser
    });
  } catch (err) {
    return handleError(res, err);
  }
};

export const getCurrentUser = (req, res) => {
  try {
    const user = UserModel.findById(req.user.id);
    if (!user) return sendError(res, 'User not found', 404);
    return res.json(user);
  } catch (err) {
    return handleError(res, err);
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = UserModel.findByEmail(email);
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      const id = `rst-${uuidv4().slice(0, 8)}`;
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      run(
        'INSERT INTO password_resets (id, email, token_hash, expires_at, used) VALUES (?, ?, ?, ?, 0)',
        [id, email, hashToken(token), expiresAt]
      );

      const resetLink = `${getFrontendBaseUrl()}/reset-password/${token}`;
      await sendMail({
        to: email,
        subject: 'Password Reset Instructions - Aura Luxe Spa',
        html: `<p>Hello ${user.name},</p><p>You requested a password reset. This link is valid for 1 hour:</p><p><a href="${resetLink}">${resetLink}</a></p><p>If you did not request this, you can safely ignore this email.</p>`
      });
    }
    return sendSuccess(res, null, 'If an account with that email exists, reset instructions have been dispatched.');
  } catch (err) {
    return handleError(res, err);
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return sendError(res, 'Reset token and new password are required', 400);
    }
    if (String(newPassword).length < PASSWORD_MIN_LENGTH) {
      return sendError(res, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`, 400);
    }

    const tokenHash = hashToken(token);
    const reset = queryOne(
      'SELECT * FROM password_resets WHERE token_hash = ? AND used = 0',
      [tokenHash]
    );

    if (!reset) {
      return sendError(res, 'Invalid or already-used reset token', 400);
    }
    if (new Date(reset.expires_at).getTime() < Date.now()) {
      return sendError(res, 'Reset token has expired. Please request a new one.', 400);
    }

    const user = UserModel.findByEmail(reset.email);
    if (!user) {
      return sendError(res, 'Account no longer exists', 404);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    UserModel.update(user.id, { password: hashedPassword });
    run('UPDATE password_resets SET used = 1 WHERE id = ?', [reset.id]);
    AuditModel.logAudit(user.name, 'RESET_PASSWORD', 'Password reset successfully', req.ip);

    return sendSuccess(res, null, 'Password updated successfully');
  } catch (err) {
    return handleError(res, err);
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return sendError(res, 'Current and new password are required', 400);
    }
    if (String(newPassword).length < PASSWORD_MIN_LENGTH) {
      return sendError(res, `New password must be at least ${PASSWORD_MIN_LENGTH} characters`, 400);
    }

    const userWithPass = UserModel.findByEmail(req.user.email);
    if (!userWithPass) return sendError(res, 'User not found', 404);

    const isMatch = await bcrypt.compare(currentPassword, userWithPass.password);
    if (!isMatch) return sendError(res, 'Incorrect current password', 400);

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    UserModel.update(userWithPass.id, { password: hashedPassword });
    AuditModel.logAudit(userWithPass.name, 'CHANGE_PASSWORD', 'Password changed successfully', req.ip);

    return sendSuccess(res, null, 'Password changed successfully');
  } catch (err) {
    return handleError(res, err);
  }
};
