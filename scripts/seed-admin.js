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
  if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    console.error('[seed-admin] ADMIN_SEED_PASSWORD needs 8+ characters with a letter and a number.');
    await disconnectDB();
    process.exit(1);
  }

  // Re-running this script must never silently reset a live Super Admin's
  // password or escalate another account. Use --force (or ADMIN_SEED_FORCE=true)
  // for an intentional recovery/reset.
  const force = process.argv.includes('--force') || process.env.ADMIN_SEED_FORCE === 'true';
  const existing = await AdminUser.findOne({ email });
  if (existing) {
    if (!force) {
      console.log(`[seed-admin] Super Admin already exists: ${email} — unchanged. Use --force to reset it.`);
      await disconnectDB();
      return;
    }
    existing.name = name;
    existing.password = await hashPassword(password);
    existing.role = 'Super Admin';
    existing.active = true;
    existing.failedLoginAttempts = 0;
    existing.lockoutUntil = null;
    existing.tokenVersion = (existing.tokenVersion || 0) + 1;
    await existing.save();
    console.log(`[seed-admin] Force-reset existing Super Admin: ${email}`);
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