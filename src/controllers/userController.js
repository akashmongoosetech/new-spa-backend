import AdminUser from '../models/AdminUser.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { serializeAdminUser } from '../utils/serializers.js';
import { HttpError } from '../utils/api.js';
import { logAudit } from '../services/auditService.js';
import { sendEmail } from '../services/emailService.js';
import { escapeHtml } from '../utils/sanitize.js';
import { ROLES } from '../middleware/auth.js';

// Strict privilege hierarchy. A role may only modify accounts below its own
// level; Super Admin is the only role that may touch Super Admin accounts.
const ROLE_RANK = { 'Super Admin': 3, Admin: 2, Manager: 1, Receptionist: 0 };

function rankOf(role) {
  return Object.prototype.hasOwnProperty.call(ROLE_RANK, role) ? ROLE_RANK[role] : -1;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ''));
}

export async function listUsers(req, res) {
  const users = await AdminUser.find().sort({ createdAt: -1 }).limit(500).lean();
  return res.json(users.map(serializeAdminUser));
}

function normalizeBody(body) {
  const out = {};
  if (body.name !== undefined) out.name = body.name;
  if (body.email !== undefined) out.email = String(body.email).toLowerCase().trim();
  if (body.role !== undefined) {
    if (!ROLES.includes(body.role)) throw new HttpError(400, 'Invalid role');
    out.role = body.role;
  }
  if (body.phone !== undefined) out.phone = body.phone;
  if (body.avatarUrl !== undefined || body.avatar_url !== undefined) {
    out.avatarUrl = body.avatarUrl || body.avatar_url || '';
  }
  if (body.active !== undefined) out.active = body.active === true || body.active === 1 || body.active === '1' || body.active === 'true';
  return out;
}

function bodyOr(body) {
  return body || {};
}

export async function createUser(req, res) {
  const { name, email, password, role = 'Receptionist' } = req.body || {};
  if (!name || !email || !password) {
    throw new HttpError(400, 'Name, email and password are required');
  }
  if (!isValidEmail(email)) throw new HttpError(400, 'Invalid email address');
  if (String(password).length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    throw new HttpError(400, 'Password must be at least 8 characters with a letter and a number');
  }
  if (role === 'Super Admin' && req.user.role !== 'Super Admin') {
    throw new HttpError(403, 'Only a Super Admin can create Super Admin accounts');
  }

  const existing = await AdminUser.findOne({ email: String(email).toLowerCase().trim() });
  if (existing) {
    throw new HttpError(400, 'An account with this email already exists');
  }

  const user = await AdminUser.create({
    name,
    email: String(email).toLowerCase().trim(),
    password: await hashPassword(password),
    role: ROLES.includes(role) ? role : 'Receptionist',
    phone: bodyOr(req.body).phone || '',
    active: true,
  });

  await logAudit({ action: 'create', module: 'users', details: `Created admin user ${user.email}`, req });

  return res.status(201).json(serializeAdminUser(user.toObject()));
}

export async function updateUser(req, res) {
  const user = await AdminUser.findById(req.params.id);
  if (!user) throw new HttpError(404, 'User not found');

  const body = req.body || {};
  const updates = normalizeBody(body);
  const isSelf = user._id.toString() === req.user._id.toString();
  const isSuperActor = req.user.role === 'Super Admin';
  const actorRank = rankOf(req.user.role);
  const targetRank = rankOf(user.role);

  // Strict hierarchy: lower/equal roles may not modify an account at or above
  // their own level. This is what previously let an Admin edit/deactivate a
  // Super Admin (and then take it over via email change + password reset).
  if (!isSuperActor && targetRank >= actorRank) {
    throw new HttpError(403, 'You do not have permission to modify this account');
  }

  // Role changes remain Super Admin-only.
  if (updates.role && updates.role !== user.role && !isSuperActor) {
    throw new HttpError(403, 'Only a Super Admin can change roles');
  }
  if (updates.role === 'Super Admin' && !isSuperActor) {
    throw new HttpError(403, 'Only a Super Admin can grant Super Admin');
  }

  // Guard: never demote/deactivate the last Super Admin.
  const demoting = Boolean(updates.role && updates.role !== 'Super Admin' && user.role === 'Super Admin');
  const deactivating = updates.active === false && user.active !== false;
  if ((demoting || deactivating) && user.role === 'Super Admin') {
    const superAdmins = await AdminUser.countDocuments({ role: 'Super Admin' });
    if (superAdmins <= 1) throw new HttpError(400, 'Cannot change the last Super Admin account');
  }

  // Prevent self-demotion / self-deactivation.
  if (isSelf) {
    if (updates.role && updates.role !== req.user.role) {
      throw new HttpError(400, 'You cannot change your own role');
    }
    if (updates.active === false) {
      throw new HttpError(400, 'You cannot deactivate your own account');
    }
  }

  if (updates.email !== undefined && !isValidEmail(updates.email)) {
    throw new HttpError(400, 'Invalid email address');
  }

  const oldEmail = user.email;
  const emailChanged = updates.email !== undefined && updates.email !== oldEmail;
  const passwordChanged = typeof body.password === 'string' && body.password.length > 0;
  const roleChanged = updates.role !== undefined && updates.role !== user.role;
  const activeChanged = updates.active !== undefined && updates.active !== user.active;

  // Security-sensitive operations (identity, credentials, role or account
  // state) require the acting admin to re-authenticate, so a hijacked session
  // cannot silently seize, promote or lock accounts.
  if (emailChanged || passwordChanged || roleChanged || activeChanged) {
    const actor = await AdminUser.findById(req.user._id).select('+password');
    const confirmed = await comparePassword(String(body.currentPassword || ''), actor && actor.password);
    if (!confirmed) {
      throw new HttpError(400, 'Enter your current password to confirm this security-sensitive change');
    }
  }

  const changes = [];

  if (passwordChanged) {
    if (String(body.password).length < 8 || !/[a-zA-Z]/.test(body.password) || !/\d/.test(body.password)) {
      throw new HttpError(400, 'Password must be at least 8 characters with a letter and a number');
    }
    user.password = await hashPassword(body.password);
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    changes.push('password');
  }

  if (updates.name !== undefined) { user.name = updates.name; changes.push('name'); }
  if (updates.phone !== undefined) { user.phone = updates.phone; changes.push('phone'); }
  if (updates.avatarUrl !== undefined) { user.avatarUrl = updates.avatarUrl; changes.push('avatar'); }

  if (emailChanged) {
    const exists = await AdminUser.findOne({ email: updates.email, _id: { $ne: user._id } });
    if (exists) throw new HttpError(400, 'An account with this email already exists');
    user.email = updates.email;
    // Invalidate sessions issued against the previous identity.
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    changes.push('email');
  }

  if (updates.role !== undefined && updates.role !== user.role) {
    user.role = updates.role;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    changes.push('role');
  }

  if (updates.active !== undefined && updates.active !== user.active) {
    user.active = updates.active;
    // Deactivation/reactivation revokes existing sessions immediately.
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    changes.push(updates.active ? 'activate' : 'deactivate');
  }

  if (changes.length === 0) {
    return res.json(serializeAdminUser(user.toObject()));
  }

  await user.save();

  if (emailChanged) {
    sendEmail({
      to: oldEmail,
      subject: 'Your Tripod Wellness administrator email was changed',
      html: `<p>Your administrator email was changed to <strong>${escapeHtml(user.email)}</strong>.</p><p>If you did not request this change, contact your Super Director immediately.</p>`,
      type: 'security_alert',
    }).catch(() => {});
  }

  await logAudit({
    action: 'update',
    module: 'users',
    details: `Updated admin user ${user.email} (${changes.join(', ')})`,
    req,
  });

  return res.json(serializeAdminUser(user.toObject()));
}

export async function deleteUser(req, res) {
  const user = await AdminUser.findById(req.params.id);
  if (!user) throw new HttpError(404, 'User not found');

  if (user._id.toString() === req.user._id.toString()) {
    throw new HttpError(400, 'You cannot delete your own account');
  }

  // Strict hierarchy: lower/equal roles may not delete higher-privileged
  // accounts, and only a Super Admin may delete a Super Admin.
  const actorRank = rankOf(req.user.role);
  const targetRank = rankOf(user.role);
  if (req.user.role !== 'Super Admin' && targetRank >= actorRank) {
    throw new HttpError(403, 'You do not have permission to delete this account');
  }
  if (user.role === 'Super Admin') {
    const superAdmins = await AdminUser.countDocuments({ role: 'Super Admin' });
    if (superAdmins <= 1) {
      throw new HttpError(400, 'Cannot delete the last Super Admin account');
    }
  }

  await user.deleteOne();
  await logAudit({ action: 'delete', module: 'users', details: `Deleted admin user ${user.email}`, req });

  return res.json({ success: true });
}

export default { listUsers, createUser, updateUser, deleteUser };
