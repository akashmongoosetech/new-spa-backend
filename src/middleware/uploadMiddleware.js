import multer from 'multer';
import path from 'path';
import fs from 'fs';

const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    // Only allow a known-safe extension derived from the validated MIME type.
    const ext = MIME_EXT[file.mimetype] || '.bin';
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

const MIME_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif'
};

// First bytes used to confirm the file actually matches its declared MIME type
// (MIME headers are trivially spoofable).
const MAGIC = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]]
};

function matchesMagic(buffer, signatures) {
  return signatures.some((sig) =>
    sig.every((byte, i) => buffer[i] === byte)
  );
}

const fileFilter = (req, file, cb) => {
  if (!MIME_EXT[file.mimetype]) {
    return cb(new Error('Invalid file type. Only JPEG, PNG, WEBP, and GIF images are permitted.'), false);
  }
  cb(null, true);
};

// Verify magic bytes after multer writes the file.
function verifyMagicBytes(req, res, next) {
  if (!req.file) return next();
  const filePath = path.join(uploadsDir, req.file.filename);
  try {
    const head = fs.readFileSync(filePath);
    const signatures = MAGIC[req.file.mimetype];
    if (!signatures || !matchesMagic(head, signatures)) {
      fs.unlinkSync(filePath); // remove the impostor file
      return res.status(400).json({
        success: false,
        message: 'File content does not match its declared type',
        errors: null
      });
    }
    next();
  } catch (err) {
    return next(err);
  }
}

export const uploadMiddleware = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter
});

export { verifyMagicBytes };
