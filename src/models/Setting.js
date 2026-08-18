import mongoose from 'mongoose';

const seoSchema = new mongoose.Schema(
  {
    metaTitle: { type: String, default: '' },
    metaDescription: { type: String, default: '' },
    keywords: { type: String, default: '' },
    ogImage: { type: String, default: '' },
    twitterCard: { type: String, default: 'summary_large_image' },
    enableJsonLd: { type: Boolean, default: true },
    robotsTxt: { type: String, default: 'index, follow' },
  },
  { _id: false }
);

const paymentGatewaysSchema = new mongoose.Schema(
  {
    payAtVenue: { type: Boolean, default: true },
    upiQrCode: { type: Boolean, default: true },
    razorpayEnabled: { type: Boolean, default: true },
    stripeEnabled: { type: Boolean, default: false },
  },
  { _id: false }
);

const settingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: 'default',
      unique: true,
    },
    businessName: { type: String, default: 'Aura Luxe Spa & Wellness' },
    siteName: { type: String, default: '' },
    tagline: { type: String, default: 'Premier Indian Massage Therapy & Holistic Wellness Sanctuary' },
    phone: { type: String, default: '+91 98200 12345' },
    whatsapp: { type: String, default: '+91 98200 12345' },
    email: { type: String, default: 'concierge@auraluxespa.in' },
    address: { type: String, default: 'Indore, Ujjain, Dewas' },
    city: { type: String, default: 'Indore, Ujjain, Dewas' },
    workingHours: { type: String, default: 'Mon - Sun: 09:00 AM - 10:00 PM IST' },
    openingHours: { type: String, default: '' },
    currencySymbol: { type: String, default: '₹' },
    currencyCode: { type: String, default: 'INR' },
    googleMapsUrl: { type: String, default: 'https://maps.google.com/?q=Bandra+West+Mumbai' },
    facebookUrl: { type: String, default: 'https://facebook.com/auraluxespa' },
    instagramUrl: { type: String, default: 'https://instagram.com/auraluxespa' },
    twitterUrl: { type: String, default: 'https://twitter.com/auraluxespa' },

    smtpHost: { type: String, default: '' },
    smtpPort: { type: Number, default: 587 },
    smtpUser: { type: String, default: '' },
    smtpSenderName: { type: String, default: 'Aura Luxe Concierge' },
    smtpSenderEmail: { type: String, default: '' },
    smtpConfigured: { type: Boolean, default: false },
    bookingEmailTemplate: { type: String, default: '' },
    contactEmailTemplate: { type: String, default: '' },

    bookingDurationMinutes: { type: Number, default: null },
    maxDailyBookings: { type: Number, default: null },
    maxBookingsPerSlot: { type: Number, default: 3, min: 1 },
    slotIntervalMinutes: { type: Number, default: 60, min: 15 },
    autoApproveBookings: { type: Boolean, default: true },
    advanceBookingDays: { type: Number, default: 30, min: 1 },
    cancellationNoticeHours: { type: Number, default: 4, min: 0 },

    sessionTimeoutMinutes: { type: Number, default: 60 },
    maxLoginAttempts: { type: Number, default: 5 },
    enable2FA: { type: Boolean, default: false },

    primaryColor: { type: String, default: '#2CB5A0' },
    logoUrl: { type: String, default: '' },
    faviconUrl: { type: String, default: '' },
    heroBannerUrl: { type: String, default: '' },
    heroTitle: { type: String, default: '' },
    heroSubtitle: { type: String, default: '' },

    seo: { type: seoSchema, default: () => ({}) },
    paymentGateways: { type: paymentGatewaysSchema, default: () => ({}) },
  },
  { timestamps: true }
);

export default mongoose.model('Setting', settingSchema);