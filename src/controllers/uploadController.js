import fs from 'fs';
import path from 'path';
import { publicUrl, isAllowedImageBuffer, deleteUploadFile } from '../middleware/upload.js';
import { HttpError } from '../utils/api.js';
import { logAudit } from '../services/auditService.js';

export function uploadFile(req, res) {
  if (!req.file) {
    throw new HttpError(400, 'No file uploaded — use multipart/form-data with field "file"');
  }
  const file = req.file;
  try {
    const ext = path.extname(file.filename || '').toLowerCase();
    const buf = fs.readFileSync(file.path);
    if (!isAllowedImageBuffer(buf, ext)) {
      try { fs.unlinkSync(file.path); } catch { /* ignore */ }
      throw new HttpError(400, 'File content does not match its image type');
    }
  } catch (err) {
    if (err instanceof HttpError) throw err;
    try { deleteUploadFile(file.filename); } catch { /* ignore */ }
    throw new HttpError(400, 'Could not validate uploaded file');
  }
  logAudit({ action: 'upload', module: 'uploads', details: `Uploaded ${file.originalname} (${file.mimetype})`, req });
  return res.status(201).json({
    url: publicUrl(file.filename),
    filename: file.filename,
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
  });
}

export default { uploadFile };