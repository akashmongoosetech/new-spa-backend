import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { UserModel } from '../models/UserModel.js';
import { sendError, sendSuccess, handleError } from '../utils/responseHandler.js';

export const getUsers = (req, res) => {
  try {
    const users = UserModel.getAll();
    return res.json(users);
  } catch (err) {
    return handleError(res, err);
  }
};

export const createUser = async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;
    if (!name || !email || !password) {
      return sendError(res, 'Name, email, and password are required', 400);
    }

    const existing = UserModel.findByEmail(email);
    if (existing) return sendError(res, 'Email already in use', 400);

    const hashedPassword = await bcrypt.hash(password, 10);
    const id = `usr-${uuidv4().slice(0, 8)}`;

    const user = UserModel.create({
      id, name, email, password: hashedPassword, role: role || 'Admin', phone
    });

    return res.status(201).json(user);
  } catch (err) {
    return handleError(res, err);
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (req.body.password) {
      req.body.password = await bcrypt.hash(req.body.password, 10);
    }
    const updated = UserModel.update(id, req.body);
    return res.json(updated);
  } catch (err) {
    return handleError(res, err);
  }
};

export const deleteUser = (req, res) => {
  try {
    UserModel.delete(req.params.id);
    return sendSuccess(res, null, 'User deleted');
  } catch (err) {
    return handleError(res, err);
  }
};
