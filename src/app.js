import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { errorHandler } from './middleware/errorMiddleware.js';
import { notFound } from './middleware/notFound.js';
import { securityHeaders } from './middleware/securityHeaders.js';
import { rateLimit } from './middleware/rateLimit.js';

import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import serviceRoutes from './routes/serviceRoutes.js';
import therapistRoutes from './routes/therapistRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import contactRoutes from './routes/contactRoutes.js';
import couponRoutes from './routes/couponRoutes.js';
import blogRoutes from './routes/blogRoutes.js';
import testimonialRoutes from './routes/testimonialRoutes.js';
import galleryRoutes from './routes/galleryRoutes.js';
import newsletterRoutes from './routes/newsletterRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import userRoutes from './routes/userRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import { getAvailabilitySlots } from './controllers/therapistController.js';
import { getEmailLogs } from './controllers/auditController.js';

export function createApp() {
  const app = express();

  const corsOrigins = process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(',').map((o) => o.trim())
    : ['http://localhost:5173', 'http://localhost:3000'];

  app.use(cors({
    origin: corsOrigins,
    credentials: true
  }));
  app.use(securityHeaders);
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // Per-route rate limits (login/auth stricter than general)
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: 'Too many authentication attempts. Please try again later.' });
  const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
  const writeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 60 });
  const aiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 40, message: 'AI assistant is busy. Please try again shortly.' });

  // Serve static uploads
  const uploadsDir = path.join(process.cwd(), 'uploads');
  app.use('/uploads', express.static(uploadsDir));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Direct routes expected by frontend
  app.get('/api/availability', getAvailabilitySlots);
  app.get('/api/email-logs', getEmailLogs);

  // API Route Groups
  app.use('/api/admin', generalLimiter, adminRoutes);
  app.use('/api/auth', authLimiter, authRoutes);
  app.use('/api/services', generalLimiter, serviceRoutes);
  app.use('/api/therapists', generalLimiter, therapistRoutes);
  app.use('/api/bookings', writeLimiter, bookingRoutes);
  app.use('/api/contact', writeLimiter, contactRoutes);
  app.use('/api/coupons', writeLimiter, couponRoutes);
  app.use('/api/blogs', generalLimiter, blogRoutes);
  app.use('/api/testimonials', generalLimiter, testimonialRoutes);
  app.use('/api/gallery', generalLimiter, galleryRoutes);
  app.use('/api/newsletter', writeLimiter, newsletterRoutes);
  app.use('/api/notifications', generalLimiter, notificationRoutes);
  app.use('/api/settings', generalLimiter, settingsRoutes);
  app.use('/api/users', generalLimiter, userRoutes);
  app.use('/api/audit', generalLimiter, auditRoutes);
  app.use('/api/upload', writeLimiter, uploadRoutes);
  app.use('/api/ai', aiLimiter, aiRoutes);

  // 404 (JSON) + error middleware
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
