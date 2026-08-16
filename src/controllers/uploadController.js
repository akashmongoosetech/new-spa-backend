import { sendError, handleError } from '../utils/responseHandler.js';

export const handleSingleUpload = (req, res) => {
  try {
    if (!req.file) {
      return sendError(res, 'No file uploaded', 400);
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    return res.json({
      url: fileUrl,
      filename: req.file.filename,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });
  } catch (err) {
    return handleError(res, err);
  }
};
