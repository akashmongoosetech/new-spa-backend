import env from '../config/env.js';
import Service from '../models/Service.js';
import Setting from '../models/Setting.js';

function businessContext(settings) {
  return {
    name: settings.businessName || 'Tripod Wellness',
    address: settings.address || '',
    city: settings.city || '',
    phone: settings.phone || '',
    email: settings.email || '',
    workingHours: settings.workingHours || '',
    currency: settings.currencyCode || 'INR',
    currencySymbol: settings.currencySymbol || '₹',
  };
}

function serviceList(services) {
  return services.map((s) => ({
    name: s.title,
    category: s.category || '',
    price: s.price,
    duration: `${s.durationMinutes || 60} min`,
    shortDescription: s.shortDescription || '',
  }));
}

async function buildContext() {
  const settings = (await Setting.findOne({ key: 'default' }).lean()) || {};
  const services = await Service.find({ active: { $ne: false } }).select(
    'title category price durationMinutes shortDescription'
  ).lean();
  return { biz: businessContext(settings), services: serviceList(services) };
}

function curatedReply(question, { biz, services }) {
  const q = String(question || '').toLowerCase();
  const priceMatch = services.find((s) => q.includes(s.name.toLowerCase().split(' ')[0]));
  if (priceMatch) {
    return `${priceMatch.name} is available at ${biz.currencySymbol}${priceMatch.price} (${priceMatch.duration}) — ${priceMatch.shortDescription || ''}\n\nTo reserve a slot, use the Book Now form or call us at ${biz.phone}.`;
  }
  if (q.includes('price') || q.includes('cost') || q.includes('rate')) {
    const cheap = services.filter((s) => s.price <= 500);
    return `Our treatments start from ${biz.currencySymbol}${cheap[0] ? cheap[0].price : 500}. Popular options: ${services.slice(0, 4).map((s) => `${s.name} (${biz.currencySymbol}${s.price})`).join(', ')}. Visit the Services page for the full menu.`;
  }
  if (q.includes('hour') || q.includes('timing') || q.includes('open') || q.includes('close')) {
    return `We are open ${biz.workingHours}. You can book online anytime or call ${biz.phone}.`;
  }
  if (q.includes('location') || q.includes('address') || q.includes('where')) {
    return `You'll find us at ${biz.address}, ${biz.city}. Directions: ${'https://maps.google.com/?q=' + encodeURIComponent(biz.address)}`;
  }
  if (q.includes('appointment') || q.includes('book') || q.includes('reserve')) {
    return `Booking is easy — pick a service, choose your preferred date & time slot on the Book Now page, and confirm. Prefer personal help? Call ${biz.phone} and our concierge will set it up.`;
  }
  if (q.includes('contact') || q.includes('call') || q.includes('phone') || q.includes('email')) {
    return `You can reach us at ${biz.phone} or ${biz.email}. For the fastest response, use the Contact form on our website.`;
  }
  if (q.includes('discount') || q.includes('coupon') || q.includes('offer')) {
    return `We run seasonal offers and coupon codes. Enter any coupon at checkout on the Booking page, or ask us on ${biz.phone} about current promotions.`;
  }
  const top = services.slice(0, 3).map((s) => s.name).join(', ');
  return `Welcome to ${biz.name}! We specialise in ${top}. How can I help — pricing, timings, booking, or directions?`;
}

/**
 * Answer as the spa assistant.
 * Uses Gemini when GEMINI_API_KEY is configured; otherwise returns a curated
 * reply built from the live services + settings data (safe fallback).
 */
export async function chat(message, history = []) {
  const ctx = await buildContext();

  if (!env.gemini.apiKey) {
    return { reply: curatedReply(message, ctx), source: 'fallback' };
  }

  const systemPrompt = `You are the friendly concierge assistant for ${ctx.biz.name}, a men's spa & wellness studio.

You MUST answer ONLY using the business information provided below. Never invent prices, services, or policies that are not in this data. Keep replies warm, concise (under ~120 words), and helpful. When a user wants to book, point them to the Book Now flow or the phone number.

BUSINESS INFO:
${JSON.stringify(ctx.biz, null, 2)}

SERVICE MENU:
${JSON.stringify(ctx.services, null, 2)}`;

  const messages = [{ role: 'user', parts: [{ text: systemPrompt }] }];
  const convo = history && Array.isArray(history) ? history : [];
  for (const h of convo.slice(-6)) {
    const role = h.role === 'assistant' || h.role === 'model' ? 'model' : 'user';
    messages.push({ role, parts: [{ text: h.content || h.text || '' }] });
  }
  messages.push({ role: 'user', parts: [{ text: String(message || '') }] });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.gemini.model}:generateContent?key=${env.gemini.apiKey}`;

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: messages }),
      signal: AbortSignal.timeout(15000),
    });

    if (!resp.ok) {
      console.error(`[ai] Gemini HTTP ${resp.status}`);
      return { reply: curatedReply(message, ctx), source: 'fallback' };
    }

    const data = await resp.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join(' ').trim() ||
      '';
    if (!text) {
      return { reply: curatedReply(message, ctx), source: 'fallback' };
    }
    return { reply: text, source: 'gemini' };
  } catch (err) {
    console.error('[ai] Gemini call failed:', err.message);
    return { reply: curatedReply(message, ctx), source: 'fallback' };
  }
}

export default { chat };