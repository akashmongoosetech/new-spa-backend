import { createApp } from './src/app.js';
import { initDatabase } from './src/config/database.js';

const PORT = 4789;
const BASE = `http://localhost:${PORT}`;

let failures = 0;
function check(name, cond, extra = '') {
  if (cond) {
    console.log(`  PASS ${name}`);
  } else {
    failures++;
    console.log(`  FAIL ${name} ${extra}`);
  }
}

async function req(method, path, { body, token } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = null;
  try { data = await res.json(); } catch (e) { /* non-JSON */ }
  return { status: res.status, data };
}

const app = createApp();
const server = await new Promise((resolve) => {
  const s = app.listen(PORT, () => resolve(s));
});

try {
  await initDatabase();

  console.log('--- Public endpoints ---');
  let r = await req('GET', '/api/health');
  check('health ok', r.status === 200 && r.data.status === 'ok');

  r = await req('GET', '/api/services');
  check('services list', r.status === 200 && Array.isArray(r.data) && r.data.length > 0, JSON.stringify(r.data).slice(0, 120));

  r = await req('GET', '/api/therapists');
  check('therapists list', r.status === 200 && Array.isArray(r.data) && r.data.length > 0);

  r = await req('GET', '/api/availability?date=2030-01-15&therapistId=any');
  check('availability is string array', r.status === 200 && Array.isArray(r.data) && r.data.every((s) => typeof s === 'string'), JSON.stringify(r.data).slice(0, 100));

  r = await req('POST', '/api/coupons/validate', { body: { code: 'AURA500', amount: 1500 } });
  check('coupon validate shape', r.status === 200 && r.data.valid === true && typeof r.data.discountAmount === 'number', JSON.stringify(r.data).slice(0, 120));

  console.log('--- Public booking flow ---');
  r = await req('POST', '/api/bookings', {
    body: {
      serviceId: 'srv-1', serviceTitle: 'Test Massage', therapistId: 'any', therapistName: 'Any',
      date: '2030-01-15', timeSlot: '09:00 AM', customerName: 'Test Client',
      email: 'test@example.com', phone: '+91 90000 00000', notes: 'low pressure',
      totalPaid: 1500, paymentMethod: 'pay_at_venue'
    }
  });
  check('create booking', r.status === 201 && r.data.bookingNumber, JSON.stringify(r.data).slice(0, 150));
  const bookingNumber = r.data.bookingNumber;
  const bookingId = r.data.id;

  r = await req('GET', `/api/bookings/lookup?q=${bookingNumber}`);
  check('public lookup by booking number', r.status === 200 && r.data.id === bookingId);

  r = await req('GET', `/api/bookings/lookup?q=test@example.com`);
  check('public lookup by email', r.status === 200 && r.data.id === bookingId);

  // public cancel with booking-number secret
  r = await req('PUT', `/api/bookings/${bookingId}`, { body: { status: 'cancelled', bookingNumber, notes: 'changed mind' } });
  check('public cancel with secret', r.status === 200 && r.data.status === 'cancelled', JSON.stringify(r.data).slice(0, 120));

  // public cancel WITHOUT secret must be rejected
  r = await req('PUT', `/api/bookings/${bookingId}`, { body: { status: 'confirmed' } });
  check('public update without secret rejected (401)', r.status === 401);

  console.log('--- Route protection (unauth should 401) ---');
  const protectedPaths = [
    ['GET', '/api/admin/stats'],
    ['GET', '/api/admin/notifications'],
    ['GET', '/api/bookings'],
    ['GET', '/api/contact'],
    ['GET', '/api/newsletter'],
    ['POST', '/api/upload'],
    ['GET', '/api/admin/users'],
    ['GET', '/api/admin/schedule'],
  ];
  for (const [m, p] of protectedPaths) {
    r = await req(m, p);
    check(`unauth ${m} ${p} -> 401`, r.status === 401, `got ${r.status}`);
  }

  console.log('--- Auth flow ---');
  r = await req('POST', '/api/admin/login', { body: { email: 'admin@auraluxespa.in', password: 'admin123' } });
  check('admin login', r.status === 200 && r.data.token && r.data.user, JSON.stringify(r.data).slice(0, 150));
  const token = r.data.token;

  r = await req('POST', '/api/admin/login', { body: { email: 'admin@auraluxespa.in', password: 'wrongpass' } });
  check('bad password rejected', r.status === 401);

  r = await req('GET', '/api/admin/stats', { token });
  check('authed stats', r.status === 200 && typeof r.data.totalBookings === 'number', JSON.stringify(r.data).slice(0, 150));

  r = await req('GET', '/api/bookings', { token });
  check('authed bookings list', r.status === 200 && Array.isArray(r.data));

  r = await req('GET', '/api/admin/notifications', { token });
  check('notifications shape {notifications,unreadCount}', r.status === 200 && Array.isArray(r.data.notifications) && typeof r.data.unreadCount === 'number', JSON.stringify(r.data).slice(0, 120));

  r = await req('GET', '/api/admin/schedule', { token });
  check('schedule config', r.status === 200 && Array.isArray(r.data.timeSlots));

  r = await req('POST', '/api/settings', { token, body: { businessName: 'Aura Luxe Test' } });
  check('POST settings (admin)', r.status === 200 || r.status === 201, `got ${r.status}`);

  r = await req('PUT', '/api/settings', { token, body: { businessName: 'Aura Luxe Test 2' } });
  check('PUT settings (admin)', r.status === 200, `got ${r.status}`);

  r = await req('GET', '/api/settings');
  check('public settings', r.status === 200 && r.data.businessName === 'Aura Luxe Test 2', JSON.stringify(r.data).slice(0, 80));

  r = await req('POST', '/api/services', { token, body: { title: 'Smoke Test Service', category: 'relaxation', price: 999, durationMinutes: 45 } });
  check('create service (admin)', r.status === 201 && r.data.slug, JSON.stringify(r.data).slice(0, 120));

  r = await req('POST', '/api/contact', { body: { name: 'Visitor', email: 'visitor@example.com', message: 'Hi' } });
  check('public contact create', r.status === 201 || r.status === 200, `got ${r.status}`);

  r = await req('POST', '/api/newsletter', { body: { email: 'nl@example.com' } });
  check('public newsletter subscribe', r.status === 201 || r.status === 200, `got ${r.status}`);

  r = await req('POST', '/api/admin/signup', { body: { name: 'Hacker', email: 'hacker@example.com', password: 'password123', role: 'Super Admin' } });
  check('signup cannot become Super Admin', r.status === 201 && r.data.user.role !== 'Super Admin', JSON.stringify(r.data).slice(0, 120));

  r = await req('POST', '/api/admin/change-password', { body: { currentPassword: 'admin123', newPassword: 'newpass123' } });
  check('change password without token rejected', r.status === 401);

  r = await req('POST', '/api/admin/change-password', { token, body: { currentPassword: 'admin123', newPassword: 'newpass123' } });
  check('change password with token', r.status === 200, `got ${r.status}`);

  // restore password so future smoke runs still work
  await req('POST', '/api/admin/change-password', { token, body: { currentPassword: 'newpass123', newPassword: 'admin123' } });

  r = await req('POST', '/api/bookings/trigger-reminders', { token });
  check('trigger reminders authed', r.status === 200 && typeof r.data.data?.sentCount === 'number', JSON.stringify(r.data).slice(0, 120));
} finally {
  server.close();
}

console.log(failures === 0 ? '\nSMOKE TEST: ALL PASSED' : `\nSMOKE TEST: ${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
