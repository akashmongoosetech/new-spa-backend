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

// Settings written by older builds still point at the reusable /logo.png and
// /icon.png paths. Those URLs cannot be cache-busted, so map them to the
// current content-hashed brand assets when serializing.
const LEGACY_BRAND_PATHS = new Set(['/logo.png', '/icon.png']);
const BRAND_LOGO_PATH = '/brand/tripod-wellness-logo-f1514578.png';
const BRAND_ICON_PATH = '/brand/tripod-wellness-icon-3af949f8.png';
const BRAND_PRIMARY_COLOR = '#BFA476';
const LEGACY_PRIMARY_COLORS = new Set([
  '#2CB5A0',
  '#259B89',
  '#DFBD43',
  '#C7A36A',
  '#C5A059',
  '#D4A341',
  '#B8832A',
]);

function normalizePrimaryColor(value) {
  const raw = String(value || '').trim();
  if (!raw) return BRAND_PRIMARY_COLOR;
  return LEGACY_PRIMARY_COLORS.has(raw.toUpperCase()) ? BRAND_PRIMARY_COLOR : raw;
}

function normalizeBrandUrl(value, fallback) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    if (LEGACY_BRAND_PATHS.has(new URL(raw, 'https://local.invalid').pathname)) {
      return fallback;
    }
  } catch {
    return raw;
  }
  return raw;
}

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
    first_name: u.firstName || u.first_name || '',
    last_name: u.lastName || u.last_name || '',
    username: u.username || '',
    address: u.address || '',
    city: u.city || '',
    state: u.state || '',
    country: u.country || '',
    pincode: u.pincode || '',
    dob: u.dob ? new Date(u.dob).toISOString().slice(0, 10) : '',
    gender: u.gender || '',
    created_at: u.createdAt || u.created_at,
    updated_at: u.updatedAt || u.updated_at || null,
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

// ---------- Blog (new + legacy clients read either case) ----------
import { generateExcerptHtml, getExcerptLength } from './htmlTruncate.js';
import { sanitizeHtml, extractText } from './sanitize.js';
import { resolveBlogSeo } from './blogSeo.js';

function readTimeDisplay(v) {
  if (v == null) return '';
  if (typeof v === 'number') return `${v} min read`;
  const s = String(v);
  if (/^\d+$/.test(s)) return `${s} min read`;
  return s;
}

function blogStatus(b) {
  if (b.status === 'published' || b.status === 'draft' || b.status === 'unpublished') return b.status;
  if (b.status === 'inactive') return 'unpublished';
  return b.published === false || b.published === 0 ? 'draft' : 'published';
}

function nestedSeo(seo = {}) {
  return {
    meta_title: seo.metaTitle || '',
    metaTitle: seo.metaTitle || '',
    meta_description: seo.metaDescription || '',
    metaDescription: seo.metaDescription || '',
    canonical_url: seo.canonicalUrl || '',
    canonicalUrl: seo.canonicalUrl || '',
    og_title: seo.ogTitle || '',
    ogTitle: seo.ogTitle || '',
    og_description: seo.ogDescription || '',
    ogDescription: seo.ogDescription || '',
    og_image_url: seo.ogImageUrl || '',
    ogImageUrl: seo.ogImageUrl || '',
    twitter_title: seo.twitterTitle || '',
    twitterTitle: seo.twitterTitle || '',
    twitter_description: seo.twitterDescription || '',
    twitterDescription: seo.twitterDescription || '',
    twitter_image_url: seo.twitterImageUrl || '',
    twitterImageUrl: seo.twitterImageUrl || '',
    keywords: Array.isArray(seo.keywords) ? seo.keywords : [],
  };
}

export function serializeBlogPost(b, options = {}) {
  if (!b) return null;
  const status = blogStatus(b);
  const published = status === 'published';
  const content = sanitizeHtml(b.content || '');
  const excerpt = sanitizeHtml(b.excerpt || b.summary || '');
  const excerptText = extractText(b.excerptText || excerpt || content).slice(0, 1000);
  const featuredImageUrl = b.featuredImageUrl || b.imageUrl || b.coverImage || '';
  const featuredImageAlt = b.featuredImageAlt || '';
  const readingTime = parseInt(b.readingTime || b.readTime || 1, 10) || 1;
  const sections = (Array.isArray(b.sections) ? b.sections : [])
    .slice()
    .sort((a, c) => Number(a.order || 0) - Number(c.order || 0))
    .map((section, index) => ({
      id: section.id || `${b.slug || 'section'}-${index + 1}`,
      heading: section.heading || '',
      content: sanitizeHtml(section.content || ''),
      order: Number.isFinite(Number(section.order)) ? Number(section.order) : index,
    }));
  const seo = nestedSeo(b.seo || {});
  const resolvedSeo = resolveBlogSeo({
    ...b,
    status,
    published,
    excerptText,
    featuredImageUrl,
    featuredImageAlt,
  });
  const resolvedSeoBoth = {
    ...bothCase(resolvedSeo, [
      'title', 'description', 'canonicalUrl', 'robots', 'type', 'ogTitle',
      'ogDescription', 'ogImageUrl', 'ogImageAlt', 'twitterTitle',
      'twitterDescription', 'twitterImageUrl', 'twitterCard', 'keywords',
      'section', 'author', 'publishedAt', 'updatedAt',
    ]),
  };

  const core = {
    id: id(b),
    title: b.title,
    slug: b.slug,
    category: b.category || '',
    categoryId: b.categoryId ? b.categoryId.toString() : '',
    author: b.author || '',
    therapistName: b.therapistName || '',
    therapistAvatarUrl: b.therapistAvatarUrl || '',
    date: b.publishedAt || b.date || b.createdAt || b.created_at,
    publishedAt: b.publishedAt || b.date || null,
    readTime: readTimeDisplay(readingTime),
    readingTime,
    excerpt,
    excerptHtml: excerpt ? generateExcerptHtml(excerpt, getExcerptLength()) : '',
    excerptText,
    summary: excerptText,
    content,
    featuredImageUrl,
    featuredImageAlt,
    imageUrl: featuredImageUrl,
    coverImage: featuredImageUrl,
    tags: Array.isArray(b.tags) ? b.tags : [],
    published,
    status,
    isFeatured: Boolean(b.isFeatured || b.featureOnHomePage),
    featureOnHomePage: Boolean(b.isFeatured || b.featureOnHomePage),
    sections,
    seo,
    resolvedSeo: resolvedSeoBoth,
    previousSlugs: b.previousSlugs || [],
    createdBy: b.createdBy ? b.createdBy.toString() : '',
    updatedBy: b.updatedBy ? b.updatedBy.toString() : '',
    created_at: b.createdAt || b.created_at,
    updated_at: b.updatedAt || b.updated_at,
  };

  const out = bothCase(core, [
    'id', 'title', 'slug', 'category', 'categoryId', 'author', 'therapistName',
    'therapistAvatarUrl', 'date', 'publishedAt', 'readTime', 'readingTime',
    'excerpt', 'excerptHtml', 'excerptText', 'summary', 'content',
    'featuredImageUrl', 'featuredImageAlt', 'imageUrl', 'coverImage', 'tags',
    'published', 'status', 'isFeatured', 'featureOnHomePage', 'sections', 'seo',
    'resolvedSeo', 'previousSlugs', 'createdBy', 'updatedBy', 'created_at', 'updated_at',
  ]);

  // Historically the API exposed these exact snake_case aliases. Keep them so
  // older clients and the current static generator continue to work.
  out.excerpt_html = core.excerptHtml;
  out.safe_excerpt = excerptText;
  out.read_time = core.readTime;
  out.image_url = featuredImageUrl;
  out.cover_image = featuredImageUrl;
  out.feature_on_home_page = core.isFeatured ? 1 : 0;
  out.featured_image_url = featuredImageUrl;
  out.featured_image_alt = featuredImageAlt;
  out.published_at = core.publishedAt;
  out.reading_time = readingTime;
  out.is_featured = core.isFeatured;
  out.category_id = core.categoryId;
  out.previous_slugs = core.previousSlugs;
  out.resolved_seo = resolvedSeoBoth;
  if (options.redirectTo) out.redirectTo = options.redirectTo;

  return out;
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
    workingHoursStart: s.workingHoursStart || '00:00',
    workingHoursEnd: s.workingHoursEnd || '23:59',
  };
}

// ---------- BusinessSettings (mapBusinessSettings reads camelCase) ----------
export function serializePublicSettings(s) {
  const full = serializeSettings(s);
  if (!full) return null;
  const {
    smtpHost, smtpPort, smtpUser, smtpSenderEmail,
    bookingEmailSubject, contactEmailSubject,
    bookingEmailTemplate, contactEmailTemplate,
    ...rest
  } = full;
  return { ...rest, smtpConfigured: Boolean(s && (s.smtpConfigured || s.smtpHost)) };
}

export function serializeSettings(s) {
  if (!s) return null;
  const seo = s.seo && typeof s.seo === 'object' ? s.seo : {};
  const paymentGateways = s.paymentGateways || {};
  return {
    businessName: s.businessName || s.siteName || 'Tripod Wellness',
    siteName: s.businessName || s.siteName || 'Tripod Wellness',
    tagline: s.tagline || "Premier Men's Massage & Wellness Sanctuary",
    phone: s.phone || '+91-9171606807',
    whatsapp: s.whatsapp || s.phone || '+91-9171606807',
    email: s.email || 'wellnesstripod@gmail.com',
    address: s.address || 'Indore, Ujjain, Dewas',
    city: s.city || 'Indore, Ujjain, Dewas',
    workingHours: s.workingHours || s.openingHours || 'Open 24 hours, Mon - Sun (IST)',
    openingHours: s.workingHours || s.openingHours || 'Open 24 hours, Mon - Sun (IST)',
    currencySymbol: s.currencySymbol || '₹',
    currencyCode: s.currencyCode || 'INR',
    googleMapsUrl: s.googleMapsUrl || 'https://www.google.com/maps/search/?api=1&query=Indore+Ujjain+Dewas',
    facebookUrl: s.facebookUrl || 'https://facebook.com/tripodwellness',
    instagramUrl: s.instagramUrl || 'https://instagram.com/tripodwellness',
    twitterUrl: s.twitterUrl || 'https://twitter.com/tripodwellness',
    smtpHost: s.smtpHost || '',
    smtpPort: s.smtpPort || 587,
    smtpUser: s.smtpUser || '',
    smtpSenderName: s.smtpSenderName || 'Tripod Wellness Concierge',
    smtpSenderEmail: s.smtpSenderEmail || s.email || '',
    smtpConfigured: Boolean(s.smtpConfigured) || false,
    bookingEmailSubject: s.bookingEmailSubject || '',
    contactEmailSubject: s.contactEmailSubject || '',
    bookingEmailTemplate: s.bookingEmailTemplate || '',
    contactEmailTemplate: s.contactEmailTemplate || '',
    bookingDurationMinutes: s.bookingDurationMinutes,
    maxDailyBookings: s.maxDailyBookings,
    maxBookingsPerSlot: s.maxBookingsPerSlot || 3,
    slotIntervalMinutes: s.slotIntervalMinutes || 60,
    autoApproveBookings: s.autoApproveBookings === true,
    advanceBookingDays: s.advanceBookingDays || 30,
    cancellationNoticeHours: s.cancellationNoticeHours || 4,
    sessionTimeoutMinutes: s.sessionTimeoutMinutes || 60,
    maxLoginAttempts: s.maxLoginAttempts || 5,
    enable2FA: s.enable2FA || false,
    primaryColor: normalizePrimaryColor(s.primaryColor),
    logoUrl: normalizeBrandUrl(s.logoUrl, BRAND_LOGO_PATH),
    faviconUrl: normalizeBrandUrl(s.faviconUrl, BRAND_ICON_PATH),
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
      upiQrCode: paymentGateways.upiQrCode === true,
      razorpayEnabled: paymentGateways.razorpayEnabled === true,
      stripeEnabled: paymentGateways.stripeEnabled === true,
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
  serializePublicSettings,
};