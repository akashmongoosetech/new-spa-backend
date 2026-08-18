import { publicUrl } from '../middleware/upload.js';
import { HttpError } from '../utils/api.js';
import { logAudit } from '../services/auditService.js';

export function uploadFile(req, res) {
  if (!req.file) {
    throw new HttpError(400, 'No file uploaded — use multipart/form-data with field "file"');
  }
  const file = req.file;
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