import { publicUrl, validateUploadedImageFile } from '../middleware/upload.js';
import { logAudit } from '../services/auditService.js';

export function uploadFile(req, res) {
  const file = req.file;
  validateUploadedImageFile(file);
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
