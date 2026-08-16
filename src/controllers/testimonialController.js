import { v4 as uuidv4 } from 'uuid';
import { TestimonialModel } from '../models/TestimonialModel.js';
import { sendError, sendSuccess, handleError } from '../utils/responseHandler.js';

export const getTestimonials = (req, res) => {
  try {
    const list = TestimonialModel.getAll();
    return res.json(list);
  } catch (err) {
    return handleError(res, err);
  }
};

export const createTestimonial = (req, res) => {
  try {
    const { name, comment, rating, role, avatarUrl } = req.body;
    if (!name || !comment) return sendError(res, 'Name and comment are required', 400);

    const id = `tst-${uuidv4().slice(0, 8)}`;
    const newT = TestimonialModel.create({ id, name, comment, rating, role, avatarUrl });
    return res.status(201).json(newT);
  } catch (err) {
    return handleError(res, err);
  }
};

export const deleteTestimonial = (req, res) => {
  try {
    TestimonialModel.delete(req.params.id);
    return sendSuccess(res, null, 'Testimonial deleted');
  } catch (err) {
    return handleError(res, err);
  }
};
