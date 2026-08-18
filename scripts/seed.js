/**
 * Seed script — creates (only if missing):
 *   1. The initial Super Admin from ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD
 *   2. The singleton Setting document (schema defaults)
 *   3. The singleton ScheduleConfig document (schema defaults)
 *
 * No mock product data is inserted.
 */
import env from '../src/config/env.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import AdminUser from '../src/models/AdminUser.js';
import Setting from '../src/models/Setting.js';
import ScheduleConfig from '../src/models/ScheduleConfig.js';
import { hashPassword } from '../src/utils/password.js';

async function seed() {
  await connectDB();

  // 1) Super Admin
  const seedEmail = (process.env.ADMIN_SEED_EMAIL || env.adminEmail || '').trim();
  const seedPassword = (process.env.ADMIN_SEED_PASSWORD || '').trim();
  const seedName = (process.env.ADMIN_SEED_NAME || 'Master Director').trim();

  if (!seedEmail || !seedPassword) {
    console.warn('[seed] SKIPPED admin creation — set ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD in backend/.env');
  } else {
    const existing = await AdminUser.findOne({ email: seedEmail.toLowerCase() });
    if (existing) {
      console.log(`[seed] Super Admin already exists: ${seedEmail}`);
    } else {
      await AdminUser.create({
        name: seedName,
        email: seedEmail.toLowerCase(),
        password: await hashPassword(seedPassword),
        role: 'Super Admin',
      });
      console.log(`[seed] Created Super Admin: ${seedEmail}`);
    }
  }

  // 2) Setting singleton
  const setting = await Setting.findOne({ key: 'default' });
  if (setting) {
    console.log('[seed] Setting document already exists');
  } else {
    await Setting.create({ key: 'default' });
    console.log('[seed] Created default Setting document');
  }

  // 3) ScheduleConfig singleton
  const schedule = await ScheduleConfig.findOne({ key: 'default' });
  if (schedule) {
    console.log('[seed] ScheduleConfig document already exists');
  } else {
    await ScheduleConfig.create({ key: 'default' });
    console.log('[seed] Created default ScheduleConfig document');
  }

  await disconnectDB();
  console.log('[seed] Done.');
}

seed().catch((err) => {
  console.error('[seed] Failed:', err);
  process.exit(1);
});