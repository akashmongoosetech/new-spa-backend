import { connectDB, disconnectDB } from '../src/config/db.js';
import AdminUser from '../src/models/AdminUser.js';
import { hashPassword } from '../src/utils/password.js';

async function run() {
  await connectDB();
  const email = (process.env.ADMIN_SEED_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_SEED_PASSWORD || '';
  const name = process.env.ADMIN_SEED_NAME || 'Master Director';

  if (!email || !password) {
    console.log('ADMIN_SEED_EMAIL/ADMIN_SEED_PASSWORD not set.');
    await disconnectDB();
    return;
  }

  const existing = await AdminUser.findOne({ email });
  if (existing) {
    existing.name = name;
    existing.password = await hashPassword(password);
    existing.role = 'Super Admin';
    await existing.save();
    console.log(`[seed-admin] Updated existing Super Admin: ${email}`);
  } else {
    await AdminUser.create({
      name,
      email,
      password: await hashPassword(password),
      role: 'Super Admin',
    });
    console.log(`[seed-admin] Created Super Admin: ${email}`);
  }
  await disconnectDB();
}

run().catch((err) => {
  console.error('[seed-admin] Failed:', err);
  process.exit(1);
});