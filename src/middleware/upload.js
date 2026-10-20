import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import env from '../config/env.js';
import { HttpError } from '../utils/api.js';

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

/**
 * Verify the actual file signature. A spoofed Content-Type / extension is not
 * enough: the bytes must match the declared image type.
 */
export function isAllowedImageBuffer(buf, ext) {
  if (!buf || buf.length < 12) return false;
  const e = String(ext || '').toLowerCase();
  const startsWith = (sig) => sig.every((byte, i) => buf[i] === byte);

  if (e === '.jpg' || e === '.jpeg') return startsWith([0xff, 0xd8, 0xff]);
  if (e === '.png') return startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (e === '.gif') {
    const gif87a = startsWith([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]);
    const gif89a = startsWith([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    return gif87a || gif89a;
  }
  if (e === '.webp') {
    // RIFF....WEBP
    return startsWith([0x52, 0x49, 0x46, 0x46])
      && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50;
  }
  return false;
}

/**
 * Validate an uploaded image on disk and remove it if the bytes do not match.
 * Controllers call this before persisting the file URL.
 */
export function validateUploadedImageFile(file) {
  if (!file || !file.path) {
    throw new HttpError(400, 'No file uploaded — use multipart/form-data with field "file"');
  }
  const ext = path.extname(file.filename || '').toLowerCase();
  let buf;
  try {
    buf = fs.readFileSync(file.path);
  } catch {
    try { fs.unlinkSync(file.path); } catch { /* ignore */ }
    throw new HttpError(400, 'Could not read the uploaded file');
  }
  if (!isAllowedImageBuffer(buf, ext)) {
    try { fs.unlinkSync(file.path); } catch { /* ignore */ }
    throw new HttpError(400, 'File content does not match its image type');
  }
  return true;
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
  const base = String(env.uploadPublicUrl || '').replace(/\/$/, '');
  return `${base}/uploads/${encodeURIComponent(filename)}`;
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