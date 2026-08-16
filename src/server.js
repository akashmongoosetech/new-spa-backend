import 'dotenv/config';
import { createApp } from './app.js';
import { initDatabase } from './config/db.js';

async function start() {
  await initDatabase();
  const app = createApp();
  const PORT = process.env.PORT || 3000;

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
  });
}

start();
