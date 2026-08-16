import { query, run } from '../config/db.js';
import { safeJsonParse, safeJsonStringify } from '../utils/helpers.js';

export class SettingsModel {
  static getSettings() {
    const rows = query('SELECT * FROM settings');
    const settings = {
      siteName: "Aura Luxe Spa",
      tagline: "Bandra West's Premier Wellness Sanctuary",
      email: "concierge@auraluxespa.in",
      phone: "+91 98200 11223",
      address: "Plot 42, Bandra Reclamation, Bandra West, Mumbai, Maharashtra 400050",
      currencySymbol: "₹",
      currencyCode: "INR",
      openingHours: "Mon - Sun: 09:00 AM - 10:00 PM IST",
      googleMapsEmbedUrl: "https://maps.google.com/maps?q=Bandra+West+Mumbai&t=&z=13&ie=UTF8&iwloc=&output=embed",
      seo: {
        metaTitle: "Aura Luxe Spa | Luxury Wellness & Massage Therapy Bandra West, Mumbai",
        metaDescription: "Experience premier Swedish, Deep Tissue, Kerala Abhyanga & Volcanic Hot Stone therapies in Bandra West.",
        keywords: "massage therapy bandra west, spa in mumbai, ayurvedic massage, aura luxe spa"
      },
      emailNotifications: {
        bookingConfirmations: true,
        contactAlerts: true,
        newsletterSubscribersAlert: true,
        adminDigestFrequency: "daily"
      },
      paymentGateways: {
        payAtVenue: true,
        upiQrCode: true,
        razorpayEnabled: true,
        stripeEnabled: false
      }
    };

    rows.forEach(r => {
      settings[r.key] = safeJsonParse(r.value, r.value);
    });

    return settings;
  }

  static updateSettings(data) {
    Object.keys(data).forEach(key => {
      const val = typeof data[key] === 'object' ? safeJsonStringify(data[key]) : String(data[key]);
      run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, val]);
    });

    return this.getSettings();
  }
}
