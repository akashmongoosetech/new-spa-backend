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

const EXT_BY_MIME = new Map(ALLOWED);

function fileFilter(req, file, cb) {
  if (!ALLOWED.has(file.mimetype)) {
    const err = new Error('Only image files are allowed (JPEG, PNG, WebP, GIF)');
    err.status = 400;
    return cb(err);
  }
  const ext = String(file.originalname || '').toLowerCase().match(/\.(jpe?g|png|webp|gif)$/);
  if (!ext) {
    const err = new Error('File extension must match an image type (.jpg, .png, .webp, .gif)');
    err.status = 400;
    return cb(err);
  }
  return cb(null, true);
}

const MAGIC = [
  { ext: '.jpg', sig: [[0xff, 0xd8, 0xff]] },
  { ext: '.png', sig: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]] },
  { ext: '.gif', sig: [[0x47, 0x49, 0x46, 0x38]] },
  { ext: '.webp', sig: [[0x52, 0x49, 0x46, 0x46]] },
];

export function isAllowedImageBuffer(buf, ext) {
  if (!buf || buf.length < 12) return false;
  const e = String(ext || '').toLowerCase();
  if (e === '.jpg' || e === '.jpeg') return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (e === '.png') return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  if (e === '.gif') return buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46;
  if (e === '.webp') return buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46;
  return false;
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

/**
 * Best-effort removal of a previously uploaded file. Only ever deletes a file
 * that resolves inside the uploads directory, so remote/external URLs are never
 * touched.
 */
export function deleteUploadFile(urlOrName) {
  try {
    if (!urlOrName) return;
    const filename = path.basename(String(urlOrName).split('/').pop() || '');
    if (!filename) return;
    const filePath = path.resolve(uploadsDir, filename);
    if (filePath.startsWith(path.resolve(uploadsDir)) && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    /* best-effort */
  }
}

export default upload;