import bcrypt from 'bcryptjs';
import { queryOne, run } from '../src/config/db.js';
import { safeJsonStringify } from '../src/utils/helpers.js';

export async function seedDatabase() {
  // 1. Seed Roles
  const existingRole = queryOne('SELECT id FROM roles WHERE name = ?', ['Super Admin']);
  if (!existingRole) {
    run('INSERT INTO roles (id, name, permissions) VALUES (?, ?, ?)', [
      'role-super-admin',
      'Super Admin',
      JSON.stringify(['all'])
    ]);
    run('INSERT INTO roles (id, name, permissions) VALUES (?, ?, ?)', [
      'role-admin',
      'Admin',
      JSON.stringify(['read', 'write', 'bookings', 'services', 'therapists'])
    ]);
    run('INSERT INTO roles (id, name, permissions) VALUES (?, ?, ?)', [
      'role-manager',
      'Manager',
      JSON.stringify(['read', 'bookings'])
    ]);
  }

  // 2. Seed Users
  const adminUser = queryOne('SELECT id FROM users WHERE email = ?', ['admin@auraluxespa.in']);
  if (!adminUser) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    run(
      'INSERT INTO users (id, name, email, password, role, avatar_url, phone, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        'usr-admin-1',
        'Rajesh Sharma',
        'admin@auraluxespa.in',
        hashedPassword,
        'Super Admin',
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300',
        '+91 98200 12345',
        1
      ]
    );
  }

  // 2b. Seed Requested Admin User
  const requestedAdmin = queryOne('SELECT id FROM users WHERE email = ?', ['akashraikwar763@gmail.com']);
  if (!requestedAdmin) {
    const hashedRequestedPassword = await bcrypt.hash('Admin@123', 10);
    run(
      'INSERT INTO users (id, name, email, password, role, avatar_url, phone, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        'usr-admin-akash',
        'Akash Raikwar',
        'akashraikwar763@gmail.com',
        hashedRequestedPassword,
        'Super Admin',
        null,
        null,
        1
      ]
    );
  }

  // 3. Seed Settings
  const settingsCount = queryOne('SELECT COUNT(*) as count FROM settings');
  if (!settingsCount || settingsCount.count === 0) {
    const defaultSettings = {
      businessName: "Aura Luxe Spa & Wellness",
      tagline: "Premier Indian Massage Therapy & Holistic Wellness Sanctuary",
      phone: "+91 98200 12345",
      whatsapp: "+91 98200 12345",
      email: "concierge@auraluxespa.in",
      address: "Plot 42, Bandra Reclamation, Bandra West, Mumbai, Maharashtra 400050",
      city: "Mumbai, Maharashtra",
      workingHours: "Mon - Sun: 09:00 AM - 10:00 PM IST",
      currencySymbol: "₹",
      currencyCode: "INR",
      googleMapsUrl: "https://maps.google.com/?q=Bandra+West+Mumbai",
      facebookUrl: "https://facebook.com/auraluxespa",
      instagramUrl: "https://instagram.com/auraluxespa",
      twitterUrl: "https://twitter.com/auraluxespa",
      smtpConfigured: true,
      maxBookingsPerSlot: 3,
      slotIntervalMinutes: 60,
      autoApproveBookings: true
    };

    for (const [key, value] of Object.entries(defaultSettings)) {
      run('INSERT INTO settings (key, value) VALUES (?, ?)', [key, typeof value === 'object' ? JSON.stringify(value) : String(value)]);
    }
  }

  // 4. Seed Services
  const servicesCount = queryOne('SELECT COUNT(*) as count FROM services');
  if (!servicesCount || servicesCount.count === 0) {
    const services = [
      {
        id: "srv-1",
        title: "Signature Swedish Relaxation Massage",
        slug: "swedish-relaxation-massage",
        category: "relaxation",
        shortDescription: "Gentle long gliding strokes, kneading, and circular movements to release tension and induce deep mental clarity.",
        fullDescription: "Our Signature Swedish Therapy is meticulously tailored for gentlemen seeking ultimate stress relief. Utilizing organic warm botanical oils and smooth rhythmic strokes, this therapy eases muscle stiffness, improves blood circulation, and promotes deep physical and psychological relaxation.",
        price: 1999,
        originalPrice: 2499,
        durationMinutes: 60,
        benefits: ["Eases muscular tension & stiffness", "Enhances full-body blood circulation", "Reduces cortisol & work-related stress", "Promotes deep restorative sleep"],
        includedItems: ["Warm essential herbal oil blend", "Private steam room session (15 mins)", "Complimentary Ayurvedic herbal tea", "Custom pressure adjustments"],
        imageUrl: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?q=80&w=1200&auto=format&fit=crop",
        featured: 1,
        active: 1,
        rating: 4.9,
        reviewsCount: 128,
        faq: [{ question: "What pressure is used during Swedish massage?", answer: "Light to medium gentle pressure, completely customized to your personal preference." }]
      },
      {
        id: "srv-2",
        title: "Deep Tissue Muscle Recovery Therapy",
        slug: "deep-tissue-muscle-recovery",
        category: "deep_tissue",
        shortDescription: "Targeted firm pressure addressing chronic tight knots, postural strain, and deep muscle stiffness.",
        fullDescription: "Designed for active executives, professionals, and fitness enthusiasts. Our certified male therapists use focused elbow, forearm, and thumb pressure to target inner muscle layers, breaking down scar tissue and releasing chronic muscular trigger points.",
        price: 2499,
        originalPrice: 2999,
        durationMinutes: 60,
        benefits: ["Releases chronic lower back & neck strain", "Breaks down deep muscular adhesions & knots", "Improves posture & joint flexibility", "Accelerates athletic recovery"],
        includedItems: ["Ayurvedic Arnica & Mahanarayan oil balm", "Targeted trigger point therapy", "Post-massage hydrotherapy shower", "Refreshing coconut water hydration"],
        imageUrl: "https://images.unsplash.com/photo-1519823551278-64ac92734fb1?q=80&w=1200&auto=format&fit=crop",
        featured: 1,
        active: 1,
        rating: 5.0,
        reviewsCount: 164,
        faq: [{ question: "Is Deep Tissue painful?", answer: "You may feel intense release on tight knots, but our therapists maintain open communication to keep it comfortably therapeutic." }]
      },
      {
        id: "srv-3",
        title: "Traditional Kerala Ayurvedic Abhyanga",
        slug: "traditional-kerala-ayurvedic-abhyanga",
        category: "ayurvedic",
        shortDescription: "Warm medicated sesame herbal oils applied in synchronized rhythmic strokes to restore Vata-Pitta-Kapha balance.",
        fullDescription: "An ancient Indian wellness ritual that revitalizes body and spirit. Heated herbal oils infused with Ashwagandha, Bala, and Brahmi nourish deep tissues, drain lymphatic fluids, and rejuvenate vital organs.",
        price: 2799,
        originalPrice: 3499,
        durationMinutes: 75,
        benefits: ["Soothes nervous exhaustion", "Deeply nourishes dry skin & joints", "Boosts immune immunity & vitality", "Flushes systemic toxins"],
        includedItems: ["Authentic Kerala Kshirabala oil", "Warm herbal compress bath", "Herbal Swedana steam box bath", "Kashayam tonic elixir"],
        imageUrl: "https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?q=80&w=1200&auto=format&fit=crop",
        featured: 1,
        active: 1,
        rating: 4.95,
        reviewsCount: 210,
        faq: [{ question: "What oil is used in Abhyanga?", answer: "Authentic Kerala herbal sesame oil formulated specifically for male physical vitality." }]
      },
      {
        id: "srv-4",
        title: "Volcanic Hot Stone Therapy",
        slug: "volcanic-hot-stone-therapy",
        category: "specialized",
        shortDescription: "Smooth heated basalt lava stones glided along key energetic meridians to melt deep muscle stiffness.",
        fullDescription: "Experience deep cellular heat therapy. Smooth river lava stones heated to optimal temperature are placed along your spine and glided with aromatic massage oils to dissolve stubborn tension.",
        price: 2999,
        originalPrice: 3699,
        durationMinutes: 75,
        benefits: ["Deeply relaxes vascular & muscular nervous system", "Penetrates tight muscle tissue effortlessly", "Relieves joint arthritis & stiffness", "Enhances deep meditative state"],
        includedItems: ["Natural heated basalt volcanic stones", "Warm sandalwood infused oil", "Aromatherapy bath towel wrap"],
        imageUrl: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?q=80&w=1200&auto=format&fit=crop",
        featured: 0,
        active: 1,
        rating: 4.88,
        reviewsCount: 92,
        faq: [{ question: "Are the stones burning hot?", answer: "No, stones are kept at a soothing 125-135°F and tested on sensitive skin before application." }]
      }
    ];

    for (const s of services) {
      run(
        `INSERT INTO services (id, title, slug, category, short_description, full_description, price, original_price, duration_minutes, benefits, included_items, image_url, featured, active, rating, reviews_count, faq)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          s.id, s.title, s.slug, s.category, s.shortDescription, s.fullDescription,
          s.price, s.originalPrice, s.durationMinutes,
          safeJsonStringify(s.benefits), safeJsonStringify(s.includedItems),
          s.imageUrl, s.featured, s.active, s.rating, s.reviewsCount,
          safeJsonStringify(s.faq)
        ]
      );
    }
  }

  // 5. Seed Therapists
  const therapistsCount = queryOne('SELECT COUNT(*) as count FROM therapists');
  if (!therapistsCount || therapistsCount.count === 0) {
    const therapists = [
      {
        id: "th-1",
        name: "Rajesh Varma",
        title: "Senior Ayurvedic & Deep Tissue Master",
        role: "Lead Therapist",
        bio: "With over 12 years of experience in classical Kerala Abhyanga and neuromuscular sports rehabilitation, Rajesh specializes in relieving severe executive strain and athletic fatigue.",
        imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=600&auto=format&fit=crop",
        specialties: ["Kerala Abhyanga", "Deep Tissue", "Trigger Point Release"],
        rating: 4.98,
        reviewsCount: 310,
        experienceYears: 12,
        active: 1
      },
      {
        id: "th-2",
        name: "Vikram Malhotra",
        title: "Swedish Relaxation & Aromatherapy Specialist",
        role: "Senior Practitioner",
        bio: "Certified therapist trained in holistic European wellness techniques. Vikram creates serene, deeply restorative sessions tailored to high-stress lifestyle professionals.",
        imageUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=600&auto=format&fit=crop",
        specialties: ["Signature Swedish", "Aromatherapy", "Head & Shoulder Detox"],
        rating: 4.92,
        reviewsCount: 195,
        experienceYears: 8,
        active: 1
      },
      {
        id: "th-3",
        name: "Arjun Nair",
        title: "Sports Recovery & Hot Stone Therapist",
        role: "Bodywork Specialist",
        bio: "Former athletic conditioning specialist with certifications in hot stone thermotherapy and deep tissue myofascial release.",
        imageUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=600&auto=format&fit=crop",
        specialties: ["Volcanic Hot Stone", "Sports Recovery", "Postural Adjustment"],
        rating: 4.95,
        reviewsCount: 240,
        experienceYears: 10,
        active: 1
      }
    ];

    for (const t of therapists) {
      run(
        `INSERT INTO therapists (id, name, title, role, bio, image_url, specialties, rating, reviews_count, experience_years, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          t.id, t.name, t.title, t.role, t.bio, t.imageUrl,
          safeJsonStringify(t.specialties), t.rating, t.reviewsCount, t.experienceYears, t.active
        ]
      );
    }
  }

  // 6. Seed Coupons
  const couponsCount = queryOne('SELECT COUNT(*) as count FROM coupons');
  if (!couponsCount || couponsCount.count === 0) {
    const coupons = [
      { id: "c-1", code: "AURA500", discount: 500, discount_type: "fixed", min_amount: 1500, active: 1, expiry_date: "2026-12-31", usage_count: 14, max_uses: 200 },
      { id: "c-2", code: "FIRST10", discount: 300, discount_type: "fixed", min_amount: 1000, active: 1, expiry_date: "2026-12-31", usage_count: 42, max_uses: 500 },
      { id: "c-3", code: "VIPMUMBAI", discount: 750, discount_type: "fixed", min_amount: 2500, active: 1, expiry_date: "2026-12-31", usage_count: 8, max_uses: 100 }
    ];

    for (const c of coupons) {
      run('INSERT INTO coupons (id, code, discount, discount_type, min_amount, active, expiry_date, usage_count, max_uses) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [
        c.id, c.code, c.discount, c.discount_type, c.min_amount, c.active, c.expiry_date, c.usage_count, c.max_uses
      ]);
    }
  }

  // 7. Seed Blog Posts
  const blogCount = queryOne('SELECT COUNT(*) as count FROM blog_posts');
  if (!blogCount || blogCount.count === 0) {
    run(
      `INSERT INTO blog_posts (id, title, slug, excerpt, content, author, date, read_time, category, image_url, tags, comments_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "blog-1",
        "The Executive Guide to Lower Back Pain & Muscle Recovery",
        "executive-guide-lower-back-pain-recovery",
        "Sitting for 10+ hours daily causes severe lumbar compression. Learn how targeted deep tissue therapy restores spine alignment.",
        "Prolonged sedentary posture in modern high-pressure careers puts immense strain on the lumbar vertebrae and hamstring muscle groups. Deep tissue myofascial release combined with warm herbal oil compress breaks down chronic tightness, relieves sciatic nerve pressure, and restores natural spinal mobility.",
        "Rajesh Varma",
        "2026-07-28",
        "5 min read",
        "Wellness & Health",
        "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?q=80&w=800&auto=format&fit=crop",
        safeJsonStringify(["Back Pain", "Deep Tissue", "Executive Wellness"]),
        2
      ]
    );
  }

  // 8. Seed Testimonials
  const testimonialsCount = queryOne('SELECT COUNT(*) as count FROM testimonials');
  if (!testimonialsCount || testimonialsCount.count === 0) {
    run(
      `INSERT INTO testimonials (id, name, role, rating, comment, avatar_url, verified, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "test-1",
        "Karan Kapoor",
        "Senior Managing Director",
        5.0,
        "Aura Luxe is by far the finest men-to-men wellness sanctuary in Mumbai. The therapist was incredibly professional, hygiene was clinical, and my severe shoulder pain dissipated completely.",
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop",
        1,
        1
      ]
    );
  }

  // 9. Seed Gallery
  const galleryCount = queryOne('SELECT COUNT(*) as count FROM gallery');
  if (!galleryCount || galleryCount.count === 0) {
    const galleryItems = [
      { id: "gal-1", title: "Private Executive Therapy Suite", category: "Suites", image_url: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?q=80&w=800&auto=format&fit=crop" },
      { id: "gal-2", title: "Kerala Herbal Oil Preparation", category: "Ayurveda", image_url: "https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?q=80&w=800&auto=format&fit=crop" },
      { id: "gal-3", title: "Volcanic Hot Stone Treatment Room", category: "Therapy", image_url: "https://images.unsplash.com/photo-1519823551278-64ac92734fb1?q=80&w=800&auto=format&fit=crop" }
    ];

    for (const g of galleryItems) {
      run('INSERT INTO gallery (id, title, category, image_url) VALUES (?, ?, ?, ?)', [g.id, g.title, g.category, g.image_url]);
    }
  }

  // 10. Seed Notifications
  const notifCount = queryOne('SELECT COUNT(*) as count FROM notifications');
  if (!notifCount || notifCount.count === 0) {
    run(
      'INSERT INTO notifications (id, title, message, type, is_read, link) VALUES (?, ?, ?, ?, ?, ?)',
      ['notif-1', 'System Ready', 'Aura Luxe backend & SQLite database initialized successfully.', 'info', 0, '/admin']
    );
  }
}
