/**
 * Smoke test — validates the API against the exact frontend contract.
 * Requires the server to be running (npm run dev) and MongoDB up.
 * Usage: npm run smoke
 */
import env from '../src/config/env.js';
import http from 'http';

function rawMultipart(method, path, { token, fieldName, filename, contentType, data }) {
  const boundary = `----AuraLuxeSmoke${Date.now()}`;
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`),
    Buffer.from(data),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return new Promise((resolve, reject) => {
    const req = http.request(`${BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    }, (res) => {
      let text = '';
      res.on('data', (c) => (text += c));
      res.on('end', () => {
        let data = null;
        try { data = JSON.parse(text); } catch { data = text; }
        resolve({ status: res.statusCode, data });
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

const BASE = `http://localhost:${env.port}/api`;
const results = [];
let failures = 0;

function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  if (!ok) failures += 1;
  const icon = ok ? 'PASS' : 'FAIL';
  console.log(`  ${icon}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function req(method, path, { token, body, raw, headers = {} } = {}) {
  const h = { ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  if (body !== undefined && !raw) h['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: h,
    body: raw ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

function futureDate(daysAhead) {
  const d = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const token = env.jwtSecret ? 'TBD' : '';
  let authToken = null;
  let managerToken = null;
  const created = { service: null, coupon: null, manager: null };

  console.log('\n== Aura Luxe API smoke test ==\n');

  // 0) Health
  try {
    const h = await req('GET', '/health');
    check('GET /health', h.status === 200 && h.data && h.data.status === 'ok', `status=${h.status}`);
  } catch (e) {
    check('GET /health', false, e.message);
    console.log('\nServer not reachable. Start it with `npm run dev` then re-run `npm run smoke`.');
    process.exit(1);
  }

  // 1) Auth: login
  const seedEmail = process.env.ADMIN_SEED_EMAIL || env.adminEmail || 'admin@auraluxespa.com';
  const seedPassword = process.env.ADMIN_SEED_PASSWORD || '';
  const login = await req('POST', '/admin/login', { body: { email: seedEmail, password: seedPassword } });
  check('POST /admin/login', login.status === 200 && login.data.token && login.data.user, `status=${login.status}`);
  authToken = login.data?.token || null;

  check('Login returns {token,user} raw shape', !!authToken && !!login.data?.user?.role);

  // 2) Auth failures
  const noAuth = await req('GET', '/admin/users');
  check('GET /admin/users without token → 401', noAuth.status === 401);

  const badLogin = await req('POST', '/admin/login', { body: { email: seedEmail, password: 'wrong-password' } });
  check('Wrong password → 401', badLogin.status === 401, `status=${badLogin.status}`);

  // 3) Users (Super Admin)
  const users = await req('GET', '/admin/users', { token: authToken });
  check('GET /admin/users → array', users.status === 200 && Array.isArray(users.data) && users.data.length > 0);

  const newUser = await req('POST', '/admin/users', {
    token: authToken,
    body: { name: 'Smoke Manager', email: `smoke${Date.now()}@auraluxespa.test`, password: 'test1234', role: 'Manager' },
  });
  check('POST /admin/users (create Manager)', newUser.status === 201 && newUser.data.id, `status=${newUser.status}`);
  created.manager = newUser.data;

  const managerLogin = await req('POST', '/admin/login', {
    body: { email: newUser.data?.email, password: 'test1234' },
  });
  managerToken = managerLogin.data?.token || null;
  check('Manager can login', !!managerToken);

  const managerCreateUser = await req('POST', '/admin/users', {
    token: managerToken,
    body: { name: 'Nope', email: 'nope@x.test', password: 'test1234', role: 'Receptionist' },
  });
  check('Manager cannot create users → 403', managerCreateUser.status === 403, `status=${managerCreateUser.status}`);

  // 3b) Staff applications (request → review → approve → login)
  const appEmail = `smokeapp${Date.now()}@auraluxespa.test`;
  const signup = await req('POST', '/admin/signup', {
    body: { name: 'Smoke Applicant', email: appEmail, password: 'test1234', requestedRole: 'Manager' },
  });
  check('POST /admin/signup → pending application', signup.status === 201 && signup.data.success === true, `status=${signup.status}`);

  const dupSignup = await req('POST', '/admin/signup', { body: { name: 'Smoke Applicant', email: appEmail, password: 'test1234' } });
  check('POST /admin/signup duplicate email → 400', dupSignup.status === 400, `status=${dupSignup.status}`);

  const shortPw = await req('POST', '/admin/signup', { body: { name: 'Short', email: 'short@x.test', password: '123' } });
  check('POST /admin/signup short password → 400', shortPw.status === 400, `status=${shortPw.status}`);

  const superReq = await req('POST', '/admin/signup', { body: { name: 'Sup', email: 'sup@x.test', password: 'test1234', requestedRole: 'Super Admin' } });
  check('POST /admin/signup Super Admin request → 400', superReq.status === 400, `status=${superReq.status}`);

  const appsNoAuth = await req('GET', '/admin/applications');
  check('GET /admin/applications without token → 401', appsNoAuth.status === 401, `status=${appsNoAuth.status}`);

  const appsAsManager = await req('GET', '/admin/applications', { token: managerToken });
  check('GET /admin/applications as Manager → 403', appsAsManager.status === 403, `status=${appsAsManager.status}`);

  const apps = await req('GET', '/admin/applications', { token: authToken });
  const createdApp = Array.isArray(apps.data) ? apps.data.find((a) => a.email === appEmail) : null;
  check('GET /admin/applications → contains new application', apps.status === 200 && !!createdApp && createdApp.status === 'pending', `status=${apps.status}`);

  const approve = await req('POST', `/admin/applications/${createdApp?.id}/approve`, { token: authToken });
  check('POST /admin/applications/:id/approve', approve.status === 200 && approve.data.status === 'approved', `status=${approve.status}`);

  const approvedLogin = await req('POST', '/admin/login', { body: { email: appEmail, password: 'test1234' } });
  check('Approved applicant can login', approvedLogin.status === 200 && !!approvedLogin.data?.token, `status=${approvedLogin.status}`);

  // 4) Services CRUD
  const svc = await req('POST', '/services', {
    token: authToken,
    body: {
      title: `Smoke Massage ${Date.now()}`,
      category: 'Massage',
      price: 1200,
      original_price: 1500,
      duration_minutes: 60,
      short_description: 'Smoke test service',
      featured: 1,
      active: 1,
    },
  });
  check('POST /services (snake_case body)', svc.status === 201 && svc.data.title, `status=${svc.status}`);
  check('Service returns BOTH key cases', svc.data?.short_description !== undefined && svc.data?.shortDescription !== undefined);
  created.service = svc.data;

  const svcList = await req('GET', '/services');
  check('GET /services → raw array', svcList.status === 200 && Array.isArray(svcList.data));

  const svcUpd = await req('PUT', `/services/${created.service?.id}`, {
    token: authToken,
    body: { price: 1300, shortDescription: 'Updated via camelCase' },
  });
  check('PUT /services/:id (camelCase body)', svcUpd.status === 200 && svcUpd.data.price === 1300, `status=${svcUpd.status}`);

  // 5) Availability
  const avail = await req('GET', `/availability?date=${futureDate(1)}&therapistId=any`);
  check('GET /availability → plain string array', avail.status === 200 && Array.isArray(avail.data) && avail.data.every((s) => typeof s === 'string'), `slots=${avail.data?.length}`);

  // 6) Coupons
  const couponCode = `SMOKE${Date.now()}`;
  const coupon = await req('POST', '/coupons', {
    token: authToken,
    body: { code: couponCode, discount: 10, discountType: 'percent', minAmount: 0 },
  });
  check('POST /coupons', coupon.status === 201 && coupon.data.code, `status=${coupon.status}`);
  created.coupon = coupon.data;

  const valid = await req('POST', '/coupons/validate', { body: { code: couponCode, amount: 1200 } });
  check('POST /coupons/validate → {valid, discountAmount, coupon}',
    valid.status === 200 && valid.data.valid === true && valid.data.discountAmount === 120 && valid.data.coupon);

  // 7) Booking flow
  const slot = avail.data?.[0];
  const booking = await req('POST', '/bookings', {
    body: {
      customerName: 'Smoke Customer',
      email: 'smoke-customer@example.com',
      phone: '9999999999',
      serviceId: created.service?.id,
      therapistId: 'any',
      date: futureDate(1),
      timeSlot: slot,
      paymentMethod: 'pay_at_venue',
      couponCode: couponCode,
      notes: 'smoke booking',
    },
  });
  check('POST /bookings → bookingNumber assigned', booking.status === 201 && !!booking.data.bookingNumber, `status=${booking.status} ${booking.data?.message || ''}`);

  const bookingList = await req('GET', '/bookings', { token: authToken });
  check('GET /bookings (admin) → raw array', bookingList.status === 200 && Array.isArray(bookingList.data));

  const lookup = await req('GET', `/bookings/lookup?q=${booking.data?.bookingNumber}`);
  check('GET /bookings/lookup?q=bookingNumber', lookup.status === 200 && lookup.data.id === booking.data?.id, `status=${lookup.status}`);

  const lookup404 = await req('GET', '/bookings/lookup?q=NOPE-123456');
  check('GET /bookings/lookup (not found) → 404', lookup404.status === 404);

  const statusUpd = await req('PUT', `/bookings/${booking.data?.id}`, {
    token: authToken,
    body: { status: 'confirmed' },
  });
  check('PUT /bookings/:id (status)', statusUpd.status === 200 && statusUpd.data.status === 'confirmed');

  const reminder = await req('POST', `/bookings/${booking.data?.id}/send-reminder`, { token: authToken });
  check('POST /bookings/:id/send-reminder', reminder.status === 200 && reminder.data.success === true);

  // 8) Contact + newsletter
  const contact = await req('POST', '/contact', { body: { name: 'Smoke', email: 'smoke-contact@example.com', message: 'hello' } });
  check('POST /contact (public)', contact.status === 201 && contact.data.success === true, `status=${contact.status}`);

  const contacts = await req('GET', '/contact', { token: authToken });
  check('GET /contact (admin)', contacts.status === 200 && Array.isArray(contacts.data));
  const firstContact = contacts.data?.find((c) => c.email === 'smoke-contact@example.com');

  const reply = await req('POST', `/contact/${firstContact?.id}/reply`, { token: authToken, body: { replyText: 'Thanks!' } });
  check('POST /contact/:id/reply', reply.status === 200 && reply.data.status === 'replied');

  const sub = await req('POST', '/newsletter', { body: { email: 'smoke-sub@example.com' } });
  check('POST /newsletter (public)', sub.status === 201 && sub.data.success === true);

  const subs = await req('GET', '/newsletter', { token: authToken });
  check('GET /newsletter (admin)', subs.status === 200 && Array.isArray(subs.data));

  // 9) Settings + schedule
  const settings = await req('GET', '/settings');
  check('GET /settings → camelCase object', settings.status === 200 && settings.data.businessName && settings.data.currencySymbol, `status=${settings.status}`);

  const settingsUpd = await req('PUT', '/settings', { token: authToken, body: { tagline: 'Smoke updated tagline' } });
  check('PUT /settings (camelCase)', settingsUpd.status === 200 && settingsUpd.data.tagline === 'Smoke updated tagline');

  const schedule = await req('GET', '/admin/schedule', { token: authToken });
  check('GET /admin/schedule', schedule.status === 200 && Array.isArray(schedule.data.timeSlots), `status=${schedule.status}`);

  const scheduleUpd = await req('PUT', '/admin/schedule', { token: authToken, body: { emergencyClosure: false } });
  check('PUT /admin/schedule', scheduleUpd.status === 200);

  // 10) Notifications + stats
  const notif = await req('GET', '/admin/notifications', { token: authToken });
  check('GET /admin/notifications → {notifications, unreadCount}',
    notif.status === 200 && Array.isArray(notif.data.notifications) && typeof notif.data.unreadCount === 'number');

  const stats = await req('GET', '/admin/stats', { token: authToken });
  check('GET /admin/stats', stats.status === 200 && typeof stats.data.totalRevenue === 'number');

  const audit = await req('GET', '/admin/audit-logs', { token: authToken });
  check('GET /admin/audit-logs', audit.status === 200 && Array.isArray(audit.data));

  const loginAct = await req('GET', '/admin/login-activities', { token: authToken });
  check('GET /admin/login-activities', loginAct.status === 200 && Array.isArray(loginAct.data));

  // 11) Reports export
  const exportRes = await req('GET', '/admin/reports/export?type=all', { token: authToken });
  check('GET /admin/reports/export?type=all → CSV', exportRes.status === 200 && typeof exportRes.data === 'string' && exportRes.data.includes('BookingNumber'), `status=${exportRes.status} typeof=${typeof exportRes.data} preview=${typeof exportRes.data === 'string' ? exportRes.data.slice(0, 40) : JSON.stringify(exportRes.data)}`);

  const exportContacts = await req('GET', '/admin/reports/export?type=contacts', { token: authToken });
  check('GET /admin/reports/export?type=contacts → CSV', exportContacts.status === 200 && typeof exportContacts.data === 'string' && exportContacts.data.includes('Name'));

  const exportTherapists = await req('GET', '/admin/reports/export?type=therapists', { token: authToken });
  check('GET /admin/reports/export?type=therapists → CSV', exportTherapists.status === 200 && typeof exportTherapists.data === 'string' && exportTherapists.data.includes('ExperienceYears'));

  const exportServices = await req('GET', '/admin/reports/export?type=services', { token: authToken });
  check('GET /admin/reports/export?type=services → CSV', exportServices.status === 200 && typeof exportServices.data === 'string' && exportServices.data.includes('DurationMinutes'));

  const exportSubs = await req('GET', '/admin/reports/export?type=subscribers', { token: authToken });
  check('GET /admin/reports/export?type=subscribers → CSV', exportSubs.status === 200 && typeof exportSubs.data === 'string' && exportSubs.data.includes('Email'));

  const exportBad = await req('GET', '/admin/reports/export?type=bogus', { token: authToken });
  check('GET /admin/reports/export?type=bogus → 400', exportBad.status === 400);

  // 11b) /me session validation
  const me = await req('GET', '/admin/me', { token: authToken });
  check('GET /admin/me → {id, name, role}', me.status === 200 && me.data.id && me.data.name && me.data.role, `status=${me.status}`);

  // 11c) FAQs
  const faqs = await req('GET', '/faqs');
  check('GET /faqs (public) → raw array', faqs.status === 200 && Array.isArray(faqs.data) && faqs.data.length > 0);
  check('FAQ entries expose {id, question, answer, category}', !!faqs.data[0]?.id && !!faqs.data[0]?.question && !!faqs.data[0]?.answer && !!faqs.data[0]?.category);

  const faq = await req('POST', '/faqs', {
    token: authToken,
    body: { question: `Smoke FAQ ${Date.now()}?`, answer: 'Smoke answer', category: 'booking' },
  });
  check('POST /faqs (admin) → 201', faq.status === 201 && faq.data.id, `status=${faq.status}`);

  const faqUpd = await req('PUT', `/faqs/${faq.data?.id}`, {
    token: authToken,
    body: { answer: 'Updated answer' },
  });
  check('PUT /faqs/:id → updated answer', faqUpd.status === 200 && faqUpd.data.answer === 'Updated answer');

  const faq403 = await req('DELETE', `/faqs/${faq.data?.id}`, {});
  check('DELETE /faqs/:id without token → 401', faq403.status === 401);

  // 11d) Gallery enriched fields
  const gallery = await req('GET', '/gallery');
  check('GET /gallery → array with enriched fields', gallery.status === 200 && Array.isArray(gallery.data) && gallery.data.length > 0 && typeof gallery.data[0]?.description === 'string');

  // 12) Upload
  try {
    const png = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
      0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);
    const up = await rawMultipart('POST', '/upload', {
      token: authToken,
      fieldName: 'file',
      filename: 'smoke.png',
      contentType: 'image/png',
      data: png,
    });
    check('POST /upload → {url, filename, mimetype, size}',
      up.status === 201 && up.data.url && up.data.filename && up.data.mimetype === 'image/png', `status=${up.status}`);
  } catch (e) {
    check('POST /upload', false, e.message);
  }

  // 13) AI chat
  const ai = await req('POST', '/ai/chat', { body: { message: 'How much for a massage?', history: [] } });
  check('POST /ai/chat → {reply}', ai.status === 200 && typeof ai.data?.reply === 'string' && ai.data.reply.length > 0);

  // 14) Unknown route → 404 JSON error shape
  const unknown = await req('GET', '/nope/does-not-exist');
  check('Unknown route → 404 {success:false,error}', unknown.status === 404 && unknown.data.success === false && unknown.data.error);

  // 15) Cleanup
  if (created.service?.id) {
    const delSvc = await req('DELETE', `/services/${created.service.id}`, { token: authToken });
    check('DELETE /services/:id', delSvc.status === 200 && delSvc.data.success === true);
  }
  if (created.coupon?.id) {
    const delCoupon = await req('DELETE', `/coupons/${created.coupon.id}`, { token: authToken });
    check('DELETE /coupons/:id', delCoupon.status === 200 && delCoupon.data.success === true);
  }
  if (faq.data?.id) {
    const delFaq = await req('DELETE', `/faqs/${faq.data.id}`, { token: authToken });
    check('DELETE /faqs/:id (admin)', delFaq.status === 200 && delFaq.data.success === true);
  }
  if (booking.data?.id) {
    await req('DELETE', `/bookings/${booking.data.id}`, { token: authToken });
  }
  if (created.manager?.id) {
    const delUser = await req('DELETE', `/admin/users/${created.manager.id}`, { token: authToken });
    check('DELETE /admin/users/:id', delUser.status === 200 && delUser.data.success === true);
  }
  const usersAfterApp = await req('GET', '/admin/users', { token: authToken });
  const smokeAppUser = Array.isArray(usersAfterApp.data) ? usersAfterApp.data.find((u) => u.email === appEmail) : null;
  if (smokeAppUser?.id) {
    const delAppUser = await req('DELETE', `/admin/users/${smokeAppUser.id}`, { token: authToken });
    check('DELETE approved applicant user', delAppUser.status === 200 && delAppUser.data.success === true);
  }
  const subs2 = await req('GET', '/newsletter', { token: authToken });
  const smokeSub = subs2.data?.find((s) => s.email === 'smoke-sub@example.com');
  if (smokeSub?.id) await req('DELETE', `/newsletter/${smokeSub.id}`, { token: authToken });
  const contacts2 = await req('GET', '/contact', { token: authToken });
  const smokeContact = contacts2.data?.find((c) => c.email === 'smoke-contact@example.com');
  if (smokeContact?.id) await req('DELETE', `/contact/${smokeContact.id}`, { token: authToken });

  console.log(`\n== ${results.length - failures}/${results.length} checks passed (${failures} failed) ==\n`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Smoke test crashed:', err);
  process.exit(1);
});