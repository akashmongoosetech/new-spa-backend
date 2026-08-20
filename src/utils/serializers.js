/**
 * Response serializers.
 *
 * These produce EXACTLY the shapes the frontend mappers read
 * (frontend/src/services/api.ts). Content entities are emitted with BOTH
 * snake_case and camelCase keys because different frontend code paths read
 * different conventions. Bookings/coupons/settings are emitted camelCase.
 */

import { bothCase } from './normalize.js';

const id = (v) => (v && v._id ? v._id.toString() : v);

// ---------- AdminUser (mapAdminUser) ----------
export function serializeAdminUser(u, extra = {}) {
  if (!u) return null;
  return {
    id: id(u),
    name: u.name,
    email: u.email,
    role: u.role,
    active: u.active === false || u.active === 0 ? 0 : 1,
    avatar_url: u.avatarUrl || u.avatar_url || '',
    phone: u.phone || '',
    created_at: u.createdAt || u.created_at,
    last_login: u.lastLogin || u.last_login || null,
    lastLoginIp: u.lastLoginIp || u.last_login_ip || null,
    ...extra,
  };
}

// ---------- StaffApplication (mapStaffApplication reads camelCase) ----------
export function serializeStaffApplication(a) {
  if (!a) return null;
  return {
    id: id(a),
    name: a.name,
    email: a.email,
    requestedRole: a.requestedRole,
    status: a.status,
    note: a.note || '',
    reviewNote: a.reviewNote || '',
    reviewedBy: a.reviewedBy ? a.reviewedBy.toString() : '',
    createdAt: a.createdAt || a.created_at,
    reviewedAt: a.reviewedAt || null,
  };
}

// ---------- Service (mapService reads snake_case) ----------
export function serializeService(s) {
  if (!s) return null;
  return bothCase(
    {
      id: id(s),
      title: s.title,
      slug: s.slug,
      category: s.category,
      short_description: s.shortDescription,
      full_description: s.fullDescription,
      price: s.price,
      original_price: s.originalPrice,
      duration_minutes: s.durationMinutes,
      benefits: s.benefits || [],
      included_items: s.includedItems || [],
      image_url: s.imageUrl || '',
      featured: s.featured ? 1 : 0,
      active: s.active === false ? 0 : 1,
      rating: s.rating,
      reviews_count: s.reviewsCount,
      faq: s.faq || [],
    },
    [
      'id', 'title', 'slug', 'category', 'short_description', 'full_description',
      'price', 'original_price', 'duration_minutes', 'benefits', 'included_items',
      'image_url', 'featured', 'active', 'rating', 'reviews_count', 'faq',
    ]
  );
}

// ---------- Therapist (mapTherapist reads snake_case + photoUrl) ----------
export function serializeTherapist(t) {
  if (!t) return null;
  return bothCase(
    {
      id: id(t),
      name: t.name,
      title: t.title,
      experience_years: t.experienceYears,
      bio: t.bio || '',
      specialties: t.specialties || [],
      image_url: t.imageUrl || t.photoUrl || '',
      photoUrl: t.photoUrl || t.imageUrl || '',
      gallery: t.gallery || [],
      featured: t.featured ? 1 : 0,
      rating: t.rating,
      reviews_count: t.reviewsCount,
      availableDays: t.availableDays || [],
      availability: t.availability || undefined,
      active: t.active === false ? 0 : 1,
    },
    [
      'id', 'name', 'title', 'experience_years', 'bio', 'specialties', 'image_url',
      'photoUrl', 'gallery', 'featured', 'rating', 'reviews_count', 'availableDays',
      'availability', 'active',
    ]
  );
}

// ---------- Booking (mapBooking reads camelCase) ----------
export function serializeBooking(b) {
  if (!b) return null;
  const fullName = b.customerName || [b.firstName, b.lastName].filter(Boolean).join(' ').trim();
  return {
    id: id(b),
    bookingNumber: b.bookingNumber || '',
    customerName: fullName,
    firstName: b.firstName || (fullName.split(' ')[0] || ''),
    lastName: b.lastName || (fullName.split(' ').slice(1).join(' ') || ''),
    email: b.email,
    phone: b.phone,
    age: b.age,
    gender: b.gender,
    serviceId: b.serviceId,
    serviceTitle: b.serviceTitle,
    therapistId: b.therapistId,
    therapistName: b.therapistName,
    date: b.date,
    timeSlot: b.timeSlot,
    durationMinutes: b.durationMinutes,
    price: b.totalPaid ?? b.price ?? 0,
    discountAmount: b.discountAmount || 0,
    totalPaid: b.totalPaid ?? b.price ?? 0,
    couponCode: b.couponCode,
    additionalNotes: b.notes,
    notes: b.notes,
    paymentMethod: b.paymentMethod || 'pay_at_venue',
    paymentStatus: b.paymentStatus || 'pending',
    status: b.status || 'pending',
    createdAt: b.createdAt || b.created_at,
  };
}

// ---------- Testimonial (mapTestimonial reads both cases) ----------
export function serializeTestimonial(t) {
  if (!t) return null;
  return bothCase(
    {
      id: id(t),
      clientName: t.name || t.clientName,
      role: t.role,
      rating: t.rating,
      comment: t.comment,
      service_title: t.serviceTitle || t.service_title || '',
      date: t.date || t.createdAt || t.created_at,
      avatar_url: t.avatarUrl || t.avatar_url || '',
      approved: t.approved ? 1 : 0,
    },
    ['id', 'clientName', 'role', 'rating', 'comment', 'service_title', 'date', 'avatar_url', 'approved']
  );
}

// ---------- Blog (mapBlogPost reads snake_case) ----------
function readTimeDisplay(v) {
  if (v == null) return '';
  if (typeof v === 'number') return `${v} min read`;
  const s = String(v);
  if (/^\d+$/.test(s)) return `${s} min read`;
  return s;
}

export function serializeBlogPost(b) {
  if (!b) return null;
  return bothCase(
    {
      id: id(b),
      title: b.title,
      slug: b.slug,
      category: b.category,
      author: b.author,
      date: b.date || b.createdAt || b.created_at,
      read_time: readTimeDisplay(b.readTime),
      excerpt: b.excerpt || b.summary || '',
      content: b.content,
      image_url: b.imageUrl || b.cover_image || '',
      cover_image: b.imageUrl || b.cover_image || '',
      tags: b.tags || [],
      published: b.published === false || b.published === 0 ? 0 : 1,
    },
    ['id', 'title', 'slug', 'category', 'author', 'date', 'read_time', 'excerpt', 'content', 'image_url', 'cover_image', 'tags', 'published']
  );
}

// ---------- Gallery (raw, render tolerates image_url || imageUrl) ----------
export function serializeGalleryItem(g) {
  if (!g) return null;
  const base = {
    id: id(g),
    title: g.title,
    subtitle: g.subtitle || '',
    category: g.category || '',
    category_label: g.categoryLabel || '',
    image_url: g.imageUrl || g.image_url || '',
    imageUrl: g.imageUrl || g.image_url || '',
    description: g.description || '',
    highlights: g.highlights || [],
    dimensions: g.dimensions || '',
    sanitization_level: g.sanitizationLevel || g.sanitization_level || '',
    sanitizationLevel: g.sanitizationLevel || g.sanitization_level || '',
    createdAt: g.createdAt || g.created_at,
  };
  return base;
}

// ---------- Coupon (mapCoupon reads camelCase) ----------
export function serializeCoupon(c) {
  if (!c) return null;
  return {
    id: id(c),
    code: c.code,
    discountType: c.discountType === 'percent' ? 'percentage' : c.discountType || 'fixed',
    discount: c.discount ?? 0,
    discountValue: c.discount ?? 0,
    minAmount: c.minAmount ?? 0,
    expiryDate: c.expiryDate || '',
    active: c.active === true || c.active === 1 ? 1 : 0,
    usageCount: c.usageCount || 0,
    maxUses: c.maxUses || 100,
  };
}

// ---------- ContactMessage (mapContactMessage reads snake_case) ----------
export function serializeContactMessage(c) {
  if (!c) return null;
  return bothCase(
    {
      id: id(c),
      name: c.name,
      email: c.email,
      phone: c.phone || '',
      subject: c.subject || '',
      message: c.message,
      status: c.status || 'new',
      created_at: c.createdAt || c.created_at,
      replied_at: c.repliedAt || c.replied_at || null,
      reply_text: c.replyText || c.reply_text || '',
    },
    ['id', 'name', 'email', 'phone', 'subject', 'message', 'status', 'created_at', 'replied_at', 'reply_text']
  );
}

// ---------- NewsletterSubscriber ----------
export function serializeNewsletterSubscriber(s) {
  if (!s) return null;
  return {
    id: id(s),
    email: s.email,
    subscribed_at: s.subscribedAt || s.createdAt || s.created_at,
    active: s.active === false || s.active === 0 ? 0 : 1,
  };
}

// ---------- EmailLog ----------
export function serializeEmailLog(l) {
  if (!l) return null;
  return {
    id: id(l),
    to: l.to,
    subject: l.subject,
    type: l.type || 'booking_confirmation',
    sent_at: l.sentAt || l.createdAt || l.created_at,
    html_content: l.htmlContent || l.html_content || '',
  };
}

// ---------- Notification (mapNotificationItem reads snake_case) ----------
export function serializeNotification(n) {
  if (!n) return null;
  return bothCase(
    {
      id: id(n),
      type: n.type || 'info',
      title: n.title,
      message: n.message,
      created_at: n.createdAt || n.created_at,
      is_read: n.isRead || n.is_read === 1 || n.is_read === true ? 1 : 0,
      link: n.link || '',
    },
    ['id', 'type', 'title', 'message', 'created_at', 'is_read', 'link']
  );
}

// ---------- SystemAuditLog ----------
export function serializeAuditLog(l) {
  if (!l) return null;
  return bothCase(
    {
      id: id(l),
      action: l.action,
      user: l.user || l.user_name || '',
      details: l.details || l.description || '',
      timestamp: l.timestamp || l.createdAt || l.created_at,
      ip_address: l.ipAddress || l.ip_address || '',
    },
    ['id', 'action', 'user', 'details', 'timestamp', 'ip_address']
  );
}

// ---------- LoginActivity ----------
export function serializeLoginActivity(l) {
  if (!l) return null;
  return {
    id: id(l),
    userId: (l.userId || l.user_id || '').toString(),
    user_name: l.userName || l.user_name || '',
    userEmail: l.userEmail || l.user_email || l.email || '',
    timestamp: l.timestamp || l.createdAt || l.created_at,
    ip_address: l.ipAddress || l.ip_address || '',
    status: l.status,
    device_info: l.deviceInfo || l.device_info || l.user_agent || '',
  };
}

// ---------- ScheduleConfig (raw, matches the frontend type) ----------
export function serializeScheduleConfig(s) {
  if (!s) return null;
  return {
    blockedDates: s.blockedDates || [],
    holidays: s.holidays || [],
    emergencyClosure: s.emergencyClosure || false,
    emergencyClosureReason: s.emergencyClosureReason || '',
    timeSlots: s.timeSlots || [],
    workingHoursStart: s.workingHoursStart || '09:00',
    workingHoursEnd: s.workingHoursEnd || '22:00',
  };
}

// ---------- BusinessSettings (mapBusinessSettings reads camelCase) ----------
export function serializeSettings(s) {
  if (!s) return null;
  const seo = s.seo && typeof s.seo === 'object' ? s.seo : {};
  const paymentGateways = s.paymentGateways || {};
  return {
    businessName: s.businessName || s.siteName || 'Aura Luxe Spa & Wellness',
    siteName: s.businessName || s.siteName || 'Aura Luxe Spa & Wellness',
    tagline: s.tagline || 'Premier Indian Massage Therapy & Holistic Wellness Sanctuary',
    phone: s.phone || '+91 98200 12345',
    whatsapp: s.whatsapp || s.phone || '+91 98200 12345',
    email: s.email || 'concierge@auraluxespa.in',
    address: s.address || 'Indore, Ujjain, Dewas',
    city: s.city || 'Indore, Ujjain, Dewas',
    workingHours: s.workingHours || s.openingHours || 'Mon - Sun: 09:00 AM - 10:00 PM IST',
    openingHours: s.workingHours || s.openingHours || 'Mon - Sun: 09:00 AM - 10:00 PM IST',
    currencySymbol: s.currencySymbol || '₹',
    currencyCode: s.currencyCode || 'INR',
    googleMapsUrl: s.googleMapsUrl || 'https://maps.google.com/?q=Bandra+West+Mumbai',
    facebookUrl: s.facebookUrl || 'https://facebook.com/auraluxespa',
    instagramUrl: s.instagramUrl || 'https://instagram.com/auraluxespa',
    twitterUrl: s.twitterUrl || 'https://twitter.com/auraluxespa',
    smtpHost: s.smtpHost || '',
    smtpPort: s.smtpPort || 587,
    smtpUser: s.smtpUser || '',
    smtpSenderName: s.smtpSenderName || 'Aura Luxe Concierge',
    smtpSenderEmail: s.smtpSenderEmail || s.email || '',
    smtpConfigured: s.smtpConfigured !== false,
    bookingEmailTemplate: s.bookingEmailTemplate || '',
    contactEmailTemplate: s.contactEmailTemplate || '',
    bookingDurationMinutes: s.bookingDurationMinutes,
    maxDailyBookings: s.maxDailyBookings,
    maxBookingsPerSlot: s.maxBookingsPerSlot || 3,
    slotIntervalMinutes: s.slotIntervalMinutes || 60,
    autoApproveBookings: s.autoApproveBookings !== false,
    advanceBookingDays: s.advanceBookingDays || 30,
    cancellationNoticeHours: s.cancellationNoticeHours || 4,
    sessionTimeoutMinutes: s.sessionTimeoutMinutes || 60,
    maxLoginAttempts: s.maxLoginAttempts || 5,
    enable2FA: s.enable2FA || false,
    primaryColor: s.primaryColor || '#2CB5A0',
    logoUrl: s.logoUrl || '',
    faviconUrl: s.faviconUrl || '',
    heroBannerUrl: s.heroBannerUrl || '',
    heroTitle: s.heroTitle || '',
    heroSubtitle: s.heroSubtitle || '',
    metaTitle: s.metaTitle ?? seo.metaTitle,
    metaDescription: s.metaDescription ?? seo.metaDescription,
    keywords: s.keywords ?? seo.keywords,
    ogImage: s.ogImage ?? seo.ogImage,
    twitterCard: s.twitterCard ?? seo.twitterCard,
    enableJsonLd: s.enableJsonLd ?? seo.enableJsonLd,
    robotsTxt: s.robotsTxt ?? seo.robotsTxt,
    seo: seo,
    paymentGateways: {
      payAtVenue: paymentGateways.payAtVenue !== false,
      upiQrCode: paymentGateways.upiQrCode !== false,
      razorpayEnabled: paymentGateways.razorpayEnabled !== false,
      stripeEnabled: paymentGateways.stripeEnabled !== false,
    },
  };
}

export default {
  serializeAdminUser,
  serializeStaffApplication,
  serializeService,
  serializeTherapist,
  serializeBooking,
  serializeTestimonial,
  serializeBlogPost,
  serializeGalleryItem,
  serializeCoupon,
  serializeContactMessage,
  serializeNewsletterSubscriber,
  serializeEmailLog,
  serializeNotification,
  serializeAuditLog,
  serializeLoginActivity,
  serializeScheduleConfig,
  serializeSettings,
};