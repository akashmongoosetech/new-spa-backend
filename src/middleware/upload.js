import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import env from '../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(__dirname, '../../uploads');

fs.mkdirSync(uploadsDir, { recursive: true });

const ALLOWED = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
]);

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadsDir);
  },
  filename(req, file, cb) {
    const ext = ALLOWED.get(file.mimetype) || path.extname(file.originalname || '').toLowerCase();
    const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, name);
  },
});

function fileFilter(req, file, cb) {
  if (ALLOWED.has(file.mimetype)) {
    return cb(null, true);
  }
  const err = new Error('Only image files are allowed (JPEG, PNG, WebP, GIF)');
  err.status = 400;
  return cb(err);
}

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.maxUploadSizeMb * 1024 * 1024,
    files: 1,
  },
});

export function publicUrl(filename) {
  return `${env.uploadPublicUrl}/uploads/${encodeURIComponent(filename)}`;
}

export default upload;