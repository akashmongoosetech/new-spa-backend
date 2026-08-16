import { Router } from 'express';
import { handleSingleUpload } from '../controllers/uploadController.js';
import { uploadMiddleware, verifyMagicBytes } from '../middleware/uploadMiddleware.js';
import { authenticateJwt } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';

const router = Router();
router.post(
  '/',
  authenticateJwt,
  authorizeRoles('Super Admin', 'Admin'),
  uploadMiddleware.single('file'),
  verifyMagicBytes,
  handleSingleUpload
);
export default router;
