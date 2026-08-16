import { v4 as uuidv4 } from 'uuid';
import { GalleryModel } from '../models/GalleryModel.js';
import { sendError, sendSuccess, handleError } from '../utils/responseHandler.js';

export const getGallery = (req, res) => {
  try {
    const items = GalleryModel.getAll();
    return res.json(items);
  } catch (err) {
    return handleError(res, err);
  }
};

export const createGalleryItem = (req, res) => {
  try {
    const { title, category, imageUrl } = req.body;
    if (!title || !imageUrl) return sendError(res, 'Title and imageUrl are required', 400);

    const id = `gal-${uuidv4().slice(0, 8)}`;
    const item = GalleryModel.create({ id, title, category, imageUrl });
    return res.status(201).json(item);
  } catch (err) {
    return handleError(res, err);
  }
};

export const deleteGalleryItem = (req, res) => {
  try {
    GalleryModel.delete(req.params.id);
    return sendSuccess(res, null, 'Gallery item deleted');
  } catch (err) {
    return handleError(res, err);
  }
};
