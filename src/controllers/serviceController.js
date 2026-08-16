import { v4 as uuidv4 } from 'uuid';
import { ServiceModel } from '../models/ServiceModel.js';
import { generateSlug } from '../utils/helpers.js';
import { sendError, sendSuccess, handleError } from '../utils/responseHandler.js';

export const getServices = (req, res) => {
  try {
    const services = ServiceModel.getAll();
    return res.json(services);
  } catch (err) {
    return handleError(res, err);
  }
};

export const getServiceById = (req, res) => {
  try {
    const service = ServiceModel.getById(req.params.id);
    if (!service) return sendError(res, 'Service not found', 404);
    return res.json(service);
  } catch (err) {
    return handleError(res, err);
  }
};

export const createService = (req, res) => {
  try {
    const { title, category, price, shortDescription, fullDescription } = req.body;
    if (!title || !category || price === undefined) {
      return sendError(res, 'Title, category, and price are required', 400);
    }

    const id = `srv-${uuidv4().slice(0, 8)}`;
    const slug = generateSlug(title);

    const newService = ServiceModel.create({
      ...req.body,
      id,
      slug
    });

    return res.status(201).json(newService);
  } catch (err) {
    if (String(err?.message || '').includes('UNIQUE')) {
      return sendError(res, 'A service with this title already exists', 400);
    }
    return handleError(res, err);
  }
};

export const updateService = (req, res) => {
  try {
    const { id } = req.params;
    if (req.body.title) {
      req.body.slug = generateSlug(req.body.title);
    }
    const updated = ServiceModel.update(id, req.body);
    return res.json(updated);
  } catch (err) {
    if (String(err?.message || '').includes('UNIQUE')) {
      return sendError(res, 'A service with this title already exists', 400);
    }
    return handleError(res, err);
  }
};

export const deleteService = (req, res) => {
  try {
    ServiceModel.delete(req.params.id);
    return sendSuccess(res, null, 'Service deleted successfully');
  } catch (err) {
    return handleError(res, err);
  }
};
