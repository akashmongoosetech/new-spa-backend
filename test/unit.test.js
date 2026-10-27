import test from 'node:test';
import assert from 'node:assert/strict';

// The config module validates these before any app import.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'unit-test-secret-that-is-long-enough-123456';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/tripod_unit_test_unused';
process.env.CLIENT_URL = 'https://tripod.example.com';

const { isAllowedImageBuffer } = await import('../src/middleware/upload.js');
const { localDateStr, localDateOffset } = await import('../src/utils/dates.js');
const {
  newsletterUnsubscribeToken,
  verifyNewsletterUnsubscribeToken,
  newsletterUnsubscribeUrl,
} = await import('../src/utils/newsletterToken.js');
const { default: templates } = await import('../src/templates/email.js');
const { serializeSettings } = await import('../src/utils/serializers.js');

test('image signatures accept real JPEG/PNG/GIF/WebP headers', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const gif87 = Buffer.from('GIF87a000000', 'ascii');
  const gif89 = Buffer.from('GIF89a000000', 'ascii');
  const webp = Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

  assert.equal(isAllowedImageBuffer(png, '.png'), true);
  assert.equal(isAllowedImageBuffer(jpg, '.jpg'), true);
  assert.equal(isAllowedImageBuffer(jpg, '.jpeg'), true);
  assert.equal(isAllowedImageBuffer(gif87, '.gif'), true);
  assert.equal(isAllowedImageBuffer(gif89, '.gif'), true);
  assert.equal(isAllowedImageBuffer(webp, '.webp'), true);
});

test('image signatures reject spoofed or truncated files', () => {
  const html = Buffer.from('<html><script>alert(1)</script></html>', 'ascii');
  const riffOnly = Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0, 0, 0, 0]);
  const shortPng = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

  for (const ext of ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.html']) {
    assert.equal(isAllowedImageBuffer(html, ext), false, `HTML must not pass as ${ext}`);
  }
  assert.equal(isAllowedImageBuffer(riffOnly, '.webp'), false);
  assert.equal(isAllowedImageBuffer(shortPng, '.png'), false);
});

test('local date helpers do not shift through UTC', () => {
  const date = new Date(2026, 0, 2, 23, 30, 0); // local Jan 2, late evening
  assert.equal(localDateStr(date), '2026-01-02');
  assert.equal(localDateOffset(0), localDateStr(new Date()));
});

test('newsletter unsubscribe tokens are signed and purpose-bound', () => {
  const email = 'Guest@Example.com';
  const token = newsletterUnsubscribeToken(email);
  assert.equal(token, newsletterUnsubscribeToken(' guest@example.com '));
  assert.equal(verifyNewsletterUnsubscribeToken(email, token), true);
  assert.equal(verifyNewsletterUnsubscribeToken(email, 'not-a-token'), false);
  assert.equal(verifyNewsletterUnsubscribeToken('other@example.com', token), false);

  const url = newsletterUnsubscribeUrl(email);
  assert.match(url, /^https:\/\/tripod\.example\.com\/unsubscribe\?/);
  assert.match(url, /email=guest%40example\.com/);
  assert.match(url, /token=/);
});

test('transactional templates escape customer-supplied HTML', () => {
  const settings = { businessName: 'Tripod Wellness', phone: '+91-9000000000' };
  const booking = {
    bookingNumber: 'AL-1001',
    customerName: '<script>alert(1)</script>',
    email: 'guest@example.com',
    serviceTitle: '<b>Massage</b>',
    date: '2026-11-02',
    timeSlot: '10:00',
    totalPaid: 100,
    status: 'confirmed',
  };

  const html = templates.bookingConfirmation(settings, booking);
  assert.equal(html.includes('<script>alert(1)</script>'), false);
  assert.equal(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), true);
  assert.equal(html.includes('&lt;b&gt;Massage&lt;/b&gt;'), true);
  assert.equal(html.includes('AL-1001'), true);
});

test('custom email bodies are wrapped in the branded shell', () => {
  const html = templates.customEmail(
    { businessName: 'Tripod Wellness' },
    { title: 'Hello', body: '<p>Custom body</p>' }
  );
  assert.equal(html.includes('<!DOCTYPE html>'), true);
  assert.equal(html.includes('Custom body'), true);
  assert.equal(html.includes('Tripod Wellness'), true);
  assert.equal(html.includes('background:#BFA476'), true);
  assert.equal(html.includes('color:#2E2417'), true);
  assert.equal(html.includes('#2CB5A0'), false);
});

test('legacy logo settings resolve to the hashed brand assets', () => {
  const legacy = serializeSettings({
    businessName: 'Tripod Wellness',
    logoUrl: '/logo.png',
    faviconUrl: 'https://tripod.example.com/icon.png',
  });
  assert.equal(legacy.logoUrl, '/brand/tripod-wellness-logo-f1514578.png');
  assert.equal(legacy.faviconUrl, '/brand/tripod-wellness-icon-3af949f8.png');

  const custom = serializeSettings({ logoUrl: 'https://cdn.example.com/custom.png' });
  assert.equal(custom.logoUrl, 'https://cdn.example.com/custom.png');
});

test('legacy primary colors normalize to the bronze brand palette', () => {
  assert.equal(serializeSettings({ primaryColor: '#2CB5A0' }).primaryColor, '#BFA476');
  assert.equal(serializeSettings({ primaryColor: '#259b89' }).primaryColor, '#BFA476');
  assert.equal(serializeSettings({ primaryColor: '#DFBD43' }).primaryColor, '#BFA476');
  assert.equal(serializeSettings({}).primaryColor, '#BFA476');
  assert.equal(serializeSettings({ primaryColor: '#123456' }).primaryColor, '#123456');
});

test('LLM stream concatenates chunks without inserting spaces', async () => {
  const { env } = await import('../src/config/env.js');
  const { streamResponse } = await import('../src/services/llmService.js');
  const previousKey = env.llm.apiKey;
  const previousFetch = globalThis.fetch;

  env.llm.apiKey = 'unit-test-key';
  const chunks = [
    'data: {"candidates":[{"content":{"parts":[{"text":"Hello"}]}}]}\r\n\r\n',
    'data: {"candidates":[{"content":{"parts":[{"text":" world"}]}}]}\r\n\r\n',
  ];
  const body = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  globalThis.fetch = async () => new Response(body, { status: 200 });

  try {
    const tokens = [];
    const result = await streamResponse({
      system: 'test',
      history: [],
      message: 'hi',
      onToken: (text) => tokens.push(text),
    });
    assert.equal(result.text, 'Hello world');
    assert.deepEqual(tokens, ['Hello', ' world']);
  } finally {
    env.llm.apiKey = previousKey;
    globalThis.fetch = previousFetch;
  }
});

test('newsletter welcome includes an unsubscribe link when provided', () => {
  const url = 'https://tripod.example.com/unsubscribe?email=guest%40example.com&token=abc';
  const html = templates.newsletterWelcome(
    { businessName: 'Tripod Wellness' },
    { email: 'guest@example.com' },
    url
  );
  assert.equal(html.includes('Unsubscribe'), true);
  assert.equal(html.includes(url.replace(/&/g, '&amp;')), true);
});

const {
  cleanSingleLine,
  cleanText,
  contactInputSchema,
  newsletterInputSchema,
  bookingInputSchema,
  isHoneypotFilled,
} = await import('../src/utils/inputValidation.js');

test('plain-text sanitization strips markup and control whitespace', () => {
  assert.equal(cleanSingleLine('<b>Rahul</b>  Sharma'), 'Rahul Sharma');
  assert.equal(cleanText('Line one<script>alert(1)</script>\n\n\nLine two'), 'Line one\n\nLine two');
});

test('contact and newsletter schemas require explicit consent', () => {
  assert.equal(contactInputSchema.safeParse({ name: 'A', email: 'a@example.com', message: 'Hi' }).success, false);
  assert.equal(
    contactInputSchema.safeParse({
      name: 'A',
      email: 'a@example.com',
      message: 'Hi',
      consent: true,
    }).success,
    true
  );
  assert.equal(newsletterInputSchema.safeParse({ email: 'a@example.com' }).success, false);
});

test('booking schema only accepts pay-at-venue and valid dates', () => {
  const base = {
    customerName: 'Rahul Sharma',
    email: 'rahul@example.com',
    phone: '+91 91716 06807',
    serviceId: 'service-id',
    date: '2026-11-10',
    timeSlot: '10:00',
    consent: true,
  };
  assert.equal(bookingInputSchema.safeParse({ ...base, paymentMethod: 'pay_at_venue' }).success, true);
  assert.equal(bookingInputSchema.safeParse({ ...base, paymentMethod: 'credit_card' }).success, false);
  assert.equal(bookingInputSchema.safeParse({ ...base, date: '10-11-2026' }).success, false);
});

test('honeypot fields are detected without exposing validation details', () => {
  assert.equal(isHoneypotFilled({ website: 'https://spam.example' }), true);
  assert.equal(isHoneypotFilled({ website: '' }), false);
});
