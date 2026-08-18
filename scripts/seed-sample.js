/**
 * Sample content seeder — run with: npm run seed:sample
 *
 * Inserts (only if missing) showcase content so a fresh database is not bare:
 *   - 9 gallery showcase photos (matches the public gallery showcase)
 *   - 5 FAQs
 *   - 4 therapists
 *   - 6 massage services
 *   - 3 wellness articles
 *   - 4 client testimonials
 *   - 2 welcome coupons
 */
import env from '../src/config/env.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import GalleryItem from '../src/models/GalleryItem.js';
import Faq from '../src/models/Faq.js';
import Therapist from '../src/models/Therapist.js';
import Service from '../src/models/Service.js';
import BlogPost from '../src/models/Blog.js';
import Testimonial from '../src/models/Testimonial.js';
import Coupon from '../src/models/Coupon.js';

const GALLERY = [
  {
    title: 'The Sovereign VIP Therapy Suite',
    subtitle: 'Private Master Suite with Ensuite Shower',
    category: 'suites',
    categoryLabel: 'VIP Suites',
    imageUrl: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?q=80&w=1400&auto=format&fit=crop',
    description: 'Our flagship private therapy room equipped with dual hydraulic thermal beds, adjustable chromotherapy lighting, and soundproof acoustic walls designed for absolute privacy.',
    highlights: ['350 sq. Ft. Private Space', 'Soundproof Acoustic Insulation', 'Ensuite Rainfall Shower', 'Dual Heated Massage Beds'],
    dimensions: '350 sq ft Suite',
    sanitizationLevel: 'Hospital-Grade UV-C Disinfected',
  },
  {
    title: 'Volcanic Hot Stone Therapy Station',
    subtitle: 'Professional Basalt & Jade Warmers',
    category: 'equipment',
    categoryLabel: 'Professional Equipment',
    imageUrl: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?q=80&w=1400&auto=format&fit=crop',
    description: 'Precision digital hot stone warming units housing authentic volcanic basalt stones harvested from Iceland, maintained at an optimal 54°C for deep muscle relaxation.',
    highlights: ['Icelandic Basalt Stones', 'Digital Temperature Control', 'Infrared Sanitization', 'Aromatherapy Oil Diffusers'],
    dimensions: 'Dedicated Prep Suite',
    sanitizationLevel: 'Sterilized After Each Session',
  },
  {
    title: 'Hydrotherapy Jacuzzi & Vitality Bath',
    subtitle: 'Eucalyptus Mineral Immersion',
    category: 'hydrotherapy',
    categoryLabel: 'Hydrotherapy & Steam',
    imageUrl: 'https://images.unsplash.com/photo-1507652313519-d4e9174996dd?q=80&w=1400&auto=format&fit=crop',
    description: 'Custom jacuzzi spa tub with 48 hydro-jets configured for post-massage circulation improvement, infused with magnesium flakes and pure eucalyptus essential oils.',
    highlights: ['48 Target Jet Massage', 'Magnesium Mineral Salts', 'Chromotherapy Underwater Lights', 'Private Sunken Tub'],
    dimensions: 'Hydro Pool Lounge',
    sanitizationLevel: 'Ozone Auto-Purified Water',
  },
  {
    title: 'Organic Botanical Essential Oil Bar',
    subtitle: '100% Pure Therapeutic Grade Extracts',
    category: 'equipment',
    categoryLabel: 'Professional Equipment',
    imageUrl: 'https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?q=80&w=1400&auto=format&fit=crop',
    description: 'Cold-pressed organic carrier oils including Jojoba, Sweet Almond, and Argan, custom blended by your therapist with wild lavender, sandalwood, and bergamot.',
    highlights: ['100% Cold-Pressed Organic', 'Custom Blending Bar', 'Hypoallergenic Formulations', 'Therapeutic Grade Extracts'],
    dimensions: 'Apothecary Corner',
    sanitizationLevel: 'Glass Vial Sealed Storage',
  },
  {
    title: 'Deep Tissue Muscle Recovery Suite',
    subtitle: 'Ergonomic Percussive & Stretching Suite',
    category: 'suites',
    categoryLabel: 'VIP Suites',
    imageUrl: 'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?q=80&w=1400&auto=format&fit=crop',
    description: 'Tailored for gentlemen seeking sports rehabilitation and deep knot release. Features high-density bolster cushions, stretch straps, and percussive therapy tools.',
    highlights: ['Percussive Therapy Included', 'High-Density Bolsters', 'Sports Recovery Bench', 'Zero-Gravity Recliners'],
    dimensions: 'Suite 3 • 280 sq ft',
    sanitizationLevel: 'Medical Grade Cleaned',
  },
  {
    title: 'Executive Relaxation & Tea Lounge',
    subtitle: 'Post-Treatment Hydration Sanctuary',
    category: 'ambiance',
    categoryLabel: 'Ambiance & Lounge',
    imageUrl: 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?q=80&w=1400&auto=format&fit=crop',
    description: 'Tranquil sanctuary designed for post-massage decompression. Complimentary organic herbal infusions, alkaline hydration water, and ambient soundscapes.',
    highlights: ['Complimentary Herbal Tea', 'Zero-Gravity Seating', 'Ambient Soundscapes', 'Fresh Organic Fruit'],
    dimensions: 'Main Lounge',
    sanitizationLevel: 'Continuous HEPA Air Filtered',
  },
  {
    title: 'Swedish Thermal Hydraulic Therapy Table',
    subtitle: 'Precision Electric Height Adjustment',
    category: 'equipment',
    categoryLabel: 'Professional Equipment',
    imageUrl: 'https://images.unsplash.com/photo-1512290900673-7002e8674996?q=80&w=1400&auto=format&fit=crop',
    description: 'Ultra-plush 4-inch memory foam massage beds with integrated dual-zone heating panels and face cradles engineered for pressure relief during long sessions.',
    highlights: ['4-Inch Memory Foam', 'Integrated Dual-Zone Heater', 'Hydraulic Height Adjustment', 'Pressure-Relief Face Cradle'],
    dimensions: 'Standard Equipment',
    sanitizationLevel: 'Linen Changed Every Session',
  },
  {
    title: 'Botanical Eucalyptus Steam Chamber',
    subtitle: 'Deep Pore Detoxification',
    category: 'hydrotherapy',
    categoryLabel: 'Hydrotherapy & Steam',
    imageUrl: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?q=80&w=1400&auto=format&fit=crop',
    description: 'Private marble steam bath generating 100% humidity infused with natural eucalyptus vapor to open respiratory pathways and soften muscle fascia prior to therapy.',
    highlights: ['Italian Marble Lining', 'Eucalyptus Vapor Mist', 'Built-in Ergonomic Bench', 'Private Touch Controls'],
    dimensions: 'Steam Suite 2',
    sanitizationLevel: 'Steam Auto-Sanitized',
  },
  {
    title: 'Atmospheric Warm Lighting & Zen Décor',
    subtitle: 'Calming Minimalist Aesthetics',
    category: 'ambiance',
    categoryLabel: 'Ambiance & Lounge',
    imageUrl: 'https://images.unsplash.com/photo-1596178065887-1198b6148b2b?q=80&w=1400&auto=format&fit=crop',
    description: 'Curated warm 2700K ambient illumination and natural bamboo accents designed to reduce cortisol levels and encourage immediate psychological relaxation.',
    highlights: ['Dimmable Ambient 2700K', 'Natural Bamboo & Slate', 'Acoustic Wall Panels', 'Calm Water Fountains'],
    dimensions: 'All Sanctuary Areas',
    sanitizationLevel: 'Sanitized Daily',
  },
];

const FAQS = [
  {
    category: 'general',
    order: 1,
    question: 'Is Aura Luxe strictly a professional Men-to-Men spa in Mumbai?',
    answer: 'Yes. Aura Luxe is an exclusive, licensed professional Men-to-Men massage therapy center located in Bandra West, Mumbai. All our therapists are certified male practitioners dedicated to providing elite therapeutic wellness in an ethical, comfortable, and highly professional environment.',
  },
  {
    category: 'booking',
    order: 2,
    question: 'How do I make an appointment and check therapist availability?',
    answer: 'You can easily book online through our real-time interactive booking portal. Select your desired therapy, choose your preferred male therapist, pick an available time slot, and receive instant booking confirmation via email or SMS/WhatsApp.',
  },
  {
    category: 'safety',
    order: 3,
    question: 'What hygiene and sanitation protocols are followed?',
    answer: 'We adhere to strict clinical sanitization standards. Every therapy suite, massage bed, and linen is sanitized and disinfected with UV-C technology between every client. Luxury private hot water showers are provided for every guest.',
  },
  {
    category: 'booking',
    order: 4,
    question: 'What payment methods are accepted (UPI, Paytm, Cards)?',
    answer: 'We accept all major Indian payment methods including UPI (Google Pay, PhonePe, Paytm, BHIM), NetBanking, Credit/Debit Cards, and Cash at Venue.',
  },
  {
    category: 'services',
    order: 5,
    question: 'What is the difference between Swedish, Deep Tissue, and Ayurvedic Abhyanga?',
    answer: 'Swedish massage uses gentle gliding strokes for stress relaxation. Deep Tissue uses firm pressure to break muscular knots and postural strain. Ayurvedic Abhyanga uses warm herbal oils to nourish joints and balance body doshas.',
  },
];

const THERAPISTS = [
  {
    name: 'Rajesh Sharma',
    title: 'Senior Master Therapist & Certified Sports Specialist',
    experienceYears: 10,
    bio: 'Certified neuromuscular practitioner specializing in Deep Tissue, Sports recovery, and Volcanic Hot Stone therapy with over 10 years experience catering to high-profile gentlemen in Mumbai.',
    specialties: ['Deep Tissue', 'Sports Therapy', 'Hot Stone', 'Myofascial Release'],
    imageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=600&auto=format&fit=crop',
    rating: 5.0,
    reviewsCount: 142,
    availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    active: true,
  },
  {
    name: 'Vikram Patel',
    title: 'Holistic Wellness & Swedish Relaxation Specialist',
    experienceYears: 8,
    bio: 'Renowned for his serene touch and intuitive understanding of tension distribution. Vikram specializes in Swedish, Aromatherapy, and stress alleviation rituals.',
    specialties: ['Swedish Relaxation', 'Aromatherapy', 'Organic Warm Oil', 'Scalp Therapy'],
    imageUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=600&auto=format&fit=crop',
    rating: 4.9,
    reviewsCount: 98,
    availableDays: ['Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    active: true,
  },
  {
    name: 'Arjun Verma',
    title: 'Ayurvedic Doctor & Classical Abhyanga Practitioner',
    experienceYears: 9,
    bio: 'Trained in Kerala Panchakarma institutions, Arjun brings authentic classical Abhyanga and Marma point therapy to relieve joint stiffness and restore body balance.',
    specialties: ['Ayurvedic Abhyanga', 'Kerala Oil Massage', 'Marma Therapy', 'Kizhi Poultice'],
    imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=600&auto=format&fit=crop',
    rating: 4.9,
    reviewsCount: 115,
    availableDays: ['Monday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    active: true,
  },
  {
    name: 'Sameer Khan',
    title: 'VIP Executive Spa Director & Master Bodywork Therapist',
    experienceYears: 12,
    bio: 'Former luxury 5-star hotel spa lead therapist specializing in bespoke multi-modality therapies, custom pressure work, and high-end VIP Royal Maharaja wellness rituals.',
    specialties: ['Royal Maharaja VIP Package', 'Balinese Massage', 'Thai Stretching', 'Hot Stone'],
    imageUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?q=80&w=600&auto=format&fit=crop',
    rating: 5.0,
    reviewsCount: 186,
    availableDays: ['Monday', 'Tuesday', 'Thursday', 'Friday', 'Saturday'],
    active: true,
  },
];

const SERVICES = [
  {
    title: 'Signature Swedish Relaxation Massage',
    slug: 'swedish-relaxation-massage',
    category: 'relaxation',
    shortDescription: 'Gentle long gliding strokes, kneading, and circular movements to release tension and induce deep mental clarity.',
    fullDescription: 'Our Signature Swedish Therapy is meticulously tailored for gentlemen seeking ultimate stress relief. Utilizing organic warm botanical oils and smooth rhythmic strokes, this therapy eases muscle stiffness, improves blood circulation, and promotes deep physical and psychological relaxation.',
    price: 1999,
    originalPrice: 2499,
    durationMinutes: 60,
    benefits: ['Eases muscular tension & stiffness', 'Enhances full-body blood circulation', 'Reduces cortisol & work-related stress', 'Promotes deep restorative sleep'],
    includedItems: ['Warm essential herbal oil blend', 'Private steam room session (15 mins)', 'Complimentary Ayurvedic herbal tea', 'Custom pressure adjustments'],
    imageUrl: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?q=80&w=1200&auto=format&fit=crop',
    featured: true,
    active: true,
    rating: 4.9,
    reviewsCount: 128,
    faq: [
      { question: 'What pressure is used during Swedish massage?', answer: 'Light to medium gentle pressure, completely customized to your personal preference.' },
      { question: 'Are private showers provided?', answer: 'We provide luxury private shower facilities with herbal toiletries before and after every therapy session.' },
    ],
  },
  {
    title: 'Deep Tissue Muscle Recovery Therapy',
    slug: 'deep-tissue-muscle-recovery',
    category: 'deep_tissue',
    shortDescription: 'Targeted firm pressure addressing chronic tight knots, postural strain, and deep muscle stiffness.',
    fullDescription: 'Designed for active executives, professionals, and fitness enthusiasts. Our certified male therapists use focused elbow, forearm, and thumb pressure to target inner muscle layers, breaking down scar tissue and releasing chronic muscular trigger points.',
    price: 2499,
    originalPrice: 2999,
    durationMinutes: 60,
    benefits: ['Releases chronic lower back & neck strain', 'Breaks down deep muscular adhesions & knots', 'Improves posture & joint flexibility', 'Accelerates athletic recovery'],
    includedItems: ['Ayurvedic Arnica & Mahanarayan oil balm', 'Targeted trigger point therapy', 'Post-massage hydrotherapy shower', 'Refreshing coconut water hydration'],
    imageUrl: 'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?q=80&w=1200&auto=format&fit=crop',
    featured: true,
    active: true,
    rating: 5.0,
    reviewsCount: 164,
    faq: [{ question: 'Is Deep Tissue painful?', answer: 'You may feel intense release on tight knots, but our therapists maintain open communication to keep it comfortably therapeutic.' }],
  },
  {
    title: 'Aromatherapy Stress Relief Massage',
    slug: 'aromatherapy-stress-relief',
    category: 'relaxation',
    shortDescription: 'Harmonious sensory ritual combining customized essential oil elixirs with delicate therapeutic strokes.',
    fullDescription: 'Immerse your senses in pure organic botanical extracts. Before treatment, your therapist conducts an olfactory consultation to curate a custom blend of Sandalwood, Lavender, Bergamot, and Vetiver to calm your nervous system.',
    price: 2299,
    originalPrice: 2799,
    durationMinutes: 60,
    benefits: ['Balances emotional well-being', 'Soothes tension headache & fatigue', 'Nourishes & hydrates dry skin', 'Calms hyperactive nervous system'],
    includedItems: ['Bespoke 100% pure essential oil blend', 'Warm facial steam compress', 'Scalp and temple massage', 'Organic chamomile & green tea infusion'],
    imageUrl: 'https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?q=80&w=1200&auto=format&fit=crop',
    featured: true,
    active: true,
    rating: 4.8,
    reviewsCount: 92,
    faq: [],
  },
  {
    title: 'Balinese Harmony Massage',
    slug: 'balinese-harmony-massage',
    category: 'relaxation',
    shortDescription: 'Traditional Balinese palm pressure, gentle stretches, and warm aromatic oils for holistic balance.',
    fullDescription: 'An exotic full-body therapy originating from Bali. Combines long soothing strokes, skin rolling, palm pressing, and gentle joint stretching using warm frangipani and coconut oil to stimulate blood circulation and relieve deep muscle tightness.',
    price: 2499,
    originalPrice: 2999,
    durationMinutes: 60,
    benefits: ['Restores body energy meridian flow', 'Enhances joint range of motion', 'Relieves deep physical exhaustion', 'Provides deep emotional relaxation'],
    includedItems: ['Warm aromatic Frangipani & Coconut oil', 'Acupressure palm therapy', 'Warm towel compress', 'Fresh coconut water infusion'],
    imageUrl: 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?q=80&w=1200&auto=format&fit=crop',
    featured: false,
    active: true,
    rating: 4.9,
    reviewsCount: 88,
    faq: [],
  },
  {
    title: 'Traditional Thai Body Therapy',
    slug: 'traditional-thai-massage',
    category: 'specialized',
    shortDescription: 'Rhythmic acupressure and yoga-like assisted stretches without oil to increase flexibility and vitality.',
    fullDescription: 'Performed on a comfortable floor mat, Traditional Thai Massage incorporates gentle assisted yoga postures, deep muscle compression, and Sen energy line work. It releases energy blockages and dramatically enhances physical flexibility.',
    price: 2299,
    originalPrice: 2799,
    durationMinutes: 60,
    benefits: ['Dramatically improves joint flexibility & posture', 'Releases energy blockages along Sen lines', 'Alleviates stiffness from prolonged sitting', 'Energizes body and mind'],
    includedItems: ['Loose cotton Thai attire provided', 'Assisted yoga stretching techniques', 'Herbal hot compress application', 'Ginger herbal tea'],
    imageUrl: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?q=80&w=1200&auto=format&fit=crop',
    featured: false,
    active: true,
    rating: 4.8,
    reviewsCount: 104,
    faq: [],
  },
  {
    title: 'Volcanic Hot Stone Therapy',
    slug: 'volcanic-hot-stone-therapy',
    category: 'specialized',
    shortDescription: 'Heated natural basalt stones melt away deep tension while restoring vital energy flow across muscle groups.',
    fullDescription: 'Experience deep penetrating heat with polished volcanic basalt stones heated to optimal therapeutic temperatures. Placed along energy meridians and applied with expert hands, hot stones melt away stubborn muscle tightness effortlessly.',
    price: 2999,
    originalPrice: 3599,
    durationMinutes: 75,
    benefits: ['Penetrates deep thermal relief into tight muscles', 'Accelerates toxins flushing', 'Promotes profound inner serenity', 'Improves blood and lymph vessel dilation'],
    includedItems: ['Heated basalt stone treatment', 'Warm essential herbal oils', 'Foot detox compress', 'Herbal refreshment tray'],
    imageUrl: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?q=80&w=1200&auto=format&fit=crop',
    featured: true,
    active: true,
    rating: 4.9,
    reviewsCount: 110,
    faq: [],
  },
];

const BLOGS = [
  {
    title: 'The Healing Power of Ayurvedic Abhyanga Massage in Modern Urban Life',
    slug: 'healing-power-of-ayurvedic-abhyanga',
    category: 'Ayurvedic Wellness',
    author: 'Arjun Verma',
    readTime: 5,
    summary: 'Discover how traditional warm oil Abhyanga massage reduces stress hormones, improves joint longevity, and restores physical vitality.',
    content: "In today's fast-paced urban corporate environment, professionals frequently push physical and mental limits. Classical Abhyanga therapy is far more than a luxury indulgence; it is a critical health maintenance system. Classical Ayurvedic texts highlight how daily warm herbal oil friction nourishes body tissues, enhances lymphatic drainage, balances Vata dosha, and promotes deep REM sleep.",
    imageUrl: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?q=80&w=800&auto=format&fit=crop',
    tags: ['Ayurveda', 'Abhyanga', 'Stress Management', 'Mumbai Wellness'],
    published: true,
  },
  {
    title: 'Swedish vs Deep Tissue vs Ayurvedic: Which Massage is Right for You?',
    slug: 'massage-comparison-guide-india',
    category: 'Therapy Guide',
    author: 'Vikram Patel',
    readTime: 4,
    summary: 'A comprehensive breakdown comparing techniques, pressure levels, and targeted benefits to help you choose the ideal session.',
    content: "When selecting a therapy session, gentlemen often wonder whether Swedish, Deep Tissue, or Ayurvedic Abhyanga is best suited for their body. Swedish massage uses long, rhythmic gliding strokes to promote fluid circulation. Deep Tissue targets inner muscle fibers to release chronic knots. Ayurvedic Abhyanga uses warm medicated oils to nourish joints and balance body energies.",
    imageUrl: 'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?q=80&w=800&auto=format&fit=crop',
    tags: ['Swedish', 'Deep Tissue', 'Ayurveda', 'Therapy Comparison'],
    published: true,
  },
  {
    title: 'Why Kerala Oil Therapy is Essential for Joint Mobility & Back Pain',
    slug: 'kerala-oil-therapy-back-pain-relief',
    category: 'Ayurvedic Care',
    author: 'Rajesh Sharma',
    readTime: 6,
    summary: 'Essential insights on Dhanwantharam oil, herbal Kizhi poultices, and spinal decompression for long-term back health.',
    content: 'Dhanwantharam oil and Murivenna from Kerala are world-renowned for their joint-repairing properties. Combined with warm herbal Kizhi compresses, this classical therapy penetrates deep into spinal joints, relaxing muscle spasms and relieving sciatica pain.',
    imageUrl: 'https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?q=80&w=800&auto=format&fit=crop',
    tags: ['Kerala Oil', 'Back Pain', 'Joint Health'],
    published: true,
  },
];

const TESTIMONIALS = [
  {
    name: 'Rahul Sharma',
    role: 'Management Consultant, Bandra Mumbai',
    rating: 5,
    comment: "Aura Luxe is in a league of its own. The ambiance is calming, the hygiene is immaculate, and Rajesh gave me the best Deep Tissue massage I've ever had in my life.",
    serviceTitle: 'Deep Tissue Muscle Recovery Therapy',
    approved: true,
  },
  {
    name: 'Akash Verma',
    role: 'Senior Software Architect, BKC Mumbai',
    rating: 5,
    comment: "Sitting 10 hours a day at my desk left my lower back and neck in terrible pain. Arjun's Kerala Oil therapy completely eliminated my stiffness. Highly recommended!",
    serviceTitle: 'Kerala Authentic Herbal Oil Massage',
    approved: true,
  },
  {
    name: 'Vikram Singh',
    role: 'Managing Director, Nariman Point',
    rating: 5,
    comment: 'The Royal Maharaja VIP package was an extraordinary weekend sanctuary experience. Private Jacuzzi, exceptional service, and complete executive privacy.',
    serviceTitle: 'Royal Maharaja VIP Luxury Experience',
    approved: true,
  },
  {
    name: 'Rohit Patel',
    role: 'Entrepreneur, Powai Mumbai',
    rating: 5,
    comment: 'Authentic Ayurvedic Abhyanga massage with genuine herbal oils. The therapists are extremely respectful, professional, and knowledgeable.',
    serviceTitle: 'Ayurvedic Abhyanga Massage',
    approved: true,
  },
];

const COUPONS = [
  {
    code: 'WELCOME500',
    discount: 500,
    discountType: 'fixed',
    minAmount: 1999,
    usageCount: 0,
    expiryDate: new Date('2026-12-31'),
    active: true,
  },
  {
    code: 'AURA10',
    discount: 10,
    discountType: 'percent',
    minAmount: 1500,
    usageCount: 0,
    expiryDate: new Date('2026-12-31'),
    active: true,
  },
];

async function seedMany(Model, docs, label, matchKey) {
  let inserted = 0;
  for (const doc of docs) {
    const existing = await Model.findOne({ [matchKey]: doc[matchKey] });
    if (!existing) {
      await Model.create(doc);
      inserted += 1;
    }
  }
  console.log(`[seed:sample] ${label}: ${inserted} inserted, ${docs.length - inserted} already present`);
}

async function seed() {
  await connectDB();

  await seedMany(GalleryItem, GALLERY, 'Gallery showcase', 'title');
  await seedMany(Faq, FAQS, 'FAQs', 'question');
  await seedMany(Therapist, THERAPISTS, 'Therapists', 'name');
  await seedMany(Service, SERVICES, 'Services', 'slug');
  await seedMany(BlogPost, BLOGS, 'Blog articles', 'slug');
  await seedMany(Testimonial, TESTIMONIALS, 'Testimonials', 'name');
  await seedMany(Coupon, COUPONS, 'Coupons', 'code');

  await disconnectDB();
  console.log('[seed:sample] Done.');
}

seed().catch((err) => {
  console.error('[seed:sample] Failed:', err);
  process.exit(1);
});