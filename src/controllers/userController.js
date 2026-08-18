import AdminUser from '../models/AdminUser.js';
import { hashPassword } from '../utils/password.js';
import { serializeAdminUser } from '../utils/serializers.js';
import { HttpError } from '../utils/api.js';
import { logAudit } from '../services/auditService.js';
import { ROLES } from '../middleware/auth.js';

export async function listUsers(req, res) {
  const users = await AdminUser.find().sort({ createdAt: -1 }).lean();
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
  if (body.active !== undefined) out.active = body.active === true || body.active === 1;
  return out;
}

export async function createUser(req, res) {
  const { name, email, password, role = 'Receptionist' } = req.body || {};
  if (!name || !email || !password) {
    throw new HttpError(400, 'Name, email and password are required');
  }
  if (String(password).length < 6) {
    throw new HttpError(400, 'Password must be at least 6 characters');
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
  });

  await logAudit({ action: 'create', module: 'users', details: `Created admin user ${user.email}`, req });

  return res.status(201).json(serializeAdminUser(user.toObject()));
}

function bodyOr(body) {
  return body || {};
}

export async function updateUser(req, res) {
  const user = await AdminUser.findById(req.params.id);
  if (!user) throw new HttpError(404, 'User not found');

  const updates = normalizeBody(req.body || {});

  if (updates.role && updates.role !== user.role && req.user.role !== 'Super Admin') {
    throw new HttpError(403, 'Only a Super Admin can change roles');
  }
  if (updates.role === 'Super Admin' && req.user.role !== 'Super Admin') {
    throw new HttpError(403, 'Only a Super Admin can grant Super Admin');
  }

  // Guard: never demote/deactivate the last Super Admin.
  if ((updates.role && updates.role !== 'Super Admin') || updates.active === false) {
    const superAdmins = await AdminUser.countDocuments({ role: 'Super Admin' });
    if (user.role === 'Super Admin' && superAdmins <= 1) {
      throw new HttpError(400, 'Cannot change the last Super Admin account');
    }
  }

  // Prevent self-demotion / self-deactivation.
  if (req.params.id === req.user._id.toString()) {
    if (updates.role && updates.role !== req.user.role) {
      throw new HttpError(400, 'You cannot change your own role');
    }
    if (updates.active === false) {
      throw new HttpError(400, 'You cannot deactivate your own account');
    }
  }

  Object.assign(user, updates);
  await user.save();

  await logAudit({ action: 'update', module: 'users', details: `Updated admin user ${user.email}`, req });

  return res.json(serializeAdminUser(user.toObject()));
}

export async function deleteUser(req, res) {
  const user = await AdminUser.findById(req.params.id);
  if (!user) throw new HttpError(404, 'User not found');

  if (user._id.toString() === req.user._id.toString()) {
    throw new HttpError(400, 'You cannot delete your own account');
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