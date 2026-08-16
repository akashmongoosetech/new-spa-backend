import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { seedDatabase } from '../../seeds/seedData.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirname, '../..');

let dbInstance = null;
let initPromise = null;
let saveTimer = null;
let exitFlushRegistered = false;

const getDbPath = () => {
  if (process.env.DB_PATH) {
    return path.isAbsolute(process.env.DB_PATH)
      ? process.env.DB_PATH
      : path.join(backendRoot, process.env.DB_PATH);
  }
  return path.join(backendRoot, 'database/app.sqlite');
};

export async function initDatabase() {
  if (dbInstance) return dbInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const SQL = await initSqlJs();
    const dbPath = getDbPath();
    const dbDir = path.dirname(dbPath);

    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    if (fs.existsSync(dbPath)) {
      const fileBuffer = fs.readFileSync(dbPath);
      dbInstance = new SQL.Database(fileBuffer);
    } else {
      dbInstance = new SQL.Database();
      saveDatabase(dbInstance);
    }

    dbInstance.run('PRAGMA foreign_keys = ON;');
    createTables(dbInstance);
    await seedDatabase();
    return dbInstance;
  })();

  return initPromise;
}

export function getDb() {
  if (!dbInstance) throw new Error('Database not initialized');
  return dbInstance;
}

export function saveDatabase(db) {
  const targetDb = db || dbInstance;
  if (!targetDb) return;
  const data = targetDb.export();
  const buffer = Buffer.from(data);
  const dbPath = getDbPath();
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  fs.writeFileSync(dbPath, buffer);
}

export function query(sql, params = []) {
  if (!dbInstance) throw new Error('Database not initialized');
  const stmt = dbInstance.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

export function queryOne(sql, params = []) {
  const results = query(sql, params);
  return results.length > 0 ? results[0] : null;
}

export function run(sql, params = []) {
  if (!dbInstance) throw new Error('Database not initialized');
  dbInstance.run(sql, params);
  scheduleSave();
}

// Coalesce the expensive full-DB export+write. Writes are flushed shortly after
// the last mutation and always flushed on process exit, so a crash only risks
// losing mutations from the last ~100ms.
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveDatabase(dbInstance);
  }, 100);
  registerExitFlush();
}

function registerExitFlush() {
  if (exitFlushRegistered) return;
  exitFlushRegistered = true;
  const flush = () => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    if (dbInstance) saveDatabase(dbInstance);
  };
  process.on('exit', flush);
  process.on('SIGINT', () => { flush(); process.exit(0); });
  process.on('SIGTERM', () => { flush(); process.exit(0); });
}

function createTables(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'Admin',
      avatar_url TEXT,
      phone TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      permissions TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL,
      short_description TEXT,
      full_description TEXT,
      price REAL NOT NULL,
      original_price REAL,
      duration_minutes INTEGER NOT NULL,
      benefits TEXT,
      included_items TEXT,
      image_url TEXT,
      featured INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      rating REAL DEFAULT 5.0,
      reviews_count INTEGER DEFAULT 0,
      faq TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS therapists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      title TEXT NOT NULL,
      role TEXT NOT NULL,
      bio TEXT,
      image_url TEXT,
      specialties TEXT,
      rating REAL DEFAULT 5.0,
      reviews_count INTEGER DEFAULT 0,
      experience_years INTEGER DEFAULT 5,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      booking_number TEXT UNIQUE NOT NULL,
      service_id TEXT NOT NULL,
      service_title TEXT NOT NULL,
      therapist_id TEXT NOT NULL,
      therapist_name TEXT NOT NULL,
      date TEXT NOT NULL,
      time_slot TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      notes TEXT,
      total_paid REAL NOT NULL,
      payment_method TEXT DEFAULT 'pay_at_venue',
      payment_status TEXT DEFAULT 'pending',
      status TEXT DEFAULT 'confirmed',
      coupon_code TEXT,
      discount_amount REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      subject TEXT,
      message TEXT NOT NULL,
      status TEXT DEFAULT 'unread',
      reply_text TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS coupons (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      discount REAL NOT NULL,
      discount_type TEXT DEFAULT 'fixed',
      min_amount REAL DEFAULT 0,
      active INTEGER DEFAULT 1,
      expiry_date TEXT,
      usage_count INTEGER DEFAULT 0,
      max_uses INTEGER DEFAULT 100,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS blog_posts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      excerpt TEXT,
      content TEXT NOT NULL,
      author TEXT NOT NULL,
      date TEXT NOT NULL,
      read_time TEXT,
      category TEXT,
      image_url TEXT,
      tags TEXT,
      comments_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS blog_comments (
      id TEXT PRIMARY KEY,
      blog_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      email TEXT NOT NULL,
      comment TEXT NOT NULL,
      parent_id TEXT,
      status TEXT DEFAULT 'approved',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS testimonials (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      rating REAL DEFAULT 5.0,
      comment TEXT NOT NULL,
      avatar_url TEXT,
      verified INTEGER DEFAULT 1,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS gallery (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      image_url TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      subscribed_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'info',
      is_read INTEGER DEFAULT 0,
      link TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS login_activities (
      id TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      status TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS email_logs (
      id TEXT PRIMARY KEY,
      recipient TEXT NOT NULL,
      subject TEXT NOT NULL,
      status TEXT NOT NULL,
      details TEXT,
      error TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS schedule_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      start_time TEXT DEFAULT '09:00',
      end_time TEXT DEFAULT '22:00',
      slot_duration INTEGER DEFAULT 60,
      max_bookings_per_slot INTEGER DEFAULT 3,
      closed_days TEXT DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  saveDatabase(db);
}
