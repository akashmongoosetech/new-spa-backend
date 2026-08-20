import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';

import env from './config/env.js';
import corsMiddleware from './config/cors.js';
import { notFoundHandler, errorHandler } from './utils/api.js';

import healthRoutes from './routes/healthRoutes.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import applicationRoutes from './routes/applicationRoutes.js';
import serviceRoutes from './routes/serviceRoutes.js';
import therapistRoutes from './routes/therapistRoutes.js';
import availabilityRoutes from './routes/availabilityRoutes.js';
import couponRoutes from './routes/couponRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import contactRoutes from './routes/contactRoutes.js';
import newsletterRoutes from './routes/newsletterRoutes.js';
import emailLogRoutes from './routes/emailLogRoutes.js';
import testimonialRoutes from './routes/testimonialRoutes.js';
import blogRoutes from './routes/blogRoutes.js';
import faqRoutes from './routes/faqRoutes.js';
import galleryRoutes from './routes/galleryRoutes.js';
import settingRoutes from './routes/settingRoutes.js';
import scheduleRoutes from './routes/scheduleRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import statsRoutes from './routes/statsRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import aiRoutes from './routes/aiRoutes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(corsMiddleware);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

if (env.isDevelopment) {
  app.use(morgan('dev'));
}

// Static uploaded images (public URLs built with UPLOAD_PUBLIC_URL).
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// API routes
const api = express.Router();
api.use('/health', healthRoutes);
api.use('/admin', authRoutes);
api.use('/admin/users', userRoutes);
api.use('/admin/applications', applicationRoutes);
api.use('/admin/schedule', scheduleRoutes);
api.use('/admin/notifications', notificationRoutes);
api.use('/admin/stats', statsRoutes);
api.use('/admin', auditRoutes);
api.use('/admin/reports', reportRoutes);
api.use('/services', serviceRoutes);
api.use('/therapists', therapistRoutes);
api.use('/availability', availabilityRoutes);
api.use('/coupons', couponRoutes);
api.use('/bookings', bookingRoutes);
api.use('/contact', contactRoutes);
api.use('/newsletter', newsletterRoutes);
api.use('/email-logs', emailLogRoutes);
api.use('/testimonials', testimonialRoutes);
api.use('/blogs', blogRoutes);
api.use('/faqs', faqRoutes);
api.use('/gallery', galleryRoutes);
api.use('/settings', settingRoutes);
api.use('/upload', uploadRoutes);
api.use('/ai', aiRoutes);
app.use('/api', api);

// Frontend-friendly 404 + JSON error contract.
app.use(notFoundHandler);
app.use(errorHandler);

export default app;